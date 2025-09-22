import { chromium, Browser, Page, BrowserContext } from 'playwright-core';
import fs from 'fs/promises';
import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { authenticator } from 'otplib';

const timeout = 30_000;

/**
 * メールからOTPを取得する
 * @returns OTP
 */
const getOtpFromEmail = async (): Promise<string> => {
  console.log('getOtpFromEmail...');
  const { IMAP_USER, IMAP_PASSWORD, IMAP_HOST, IMAP_PORT, MF_EMAIL_FROM } = process.env;

  if (!IMAP_USER || !IMAP_PASSWORD || !IMAP_HOST || !IMAP_PORT || !MF_EMAIL_FROM) {
    throw new Error('IMAP environment variables are not set.');
  }

  const imap = new Imap({
    user: IMAP_USER,
    password: IMAP_PASSWORD,
    host: IMAP_HOST,
    port: Number(IMAP_PORT),
    tls: true,
    authTimeout: 300000, // 認証タイムアウトを30秒に延長
  });

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          reject(err);
          return;
        }
        // 5分以内に受信したメールを検索
        const since = new Date();
        since.setMinutes(since.getMinutes() - 5);

        imap.search([['FROM', MF_EMAIL_FROM], ['SINCE', since.toISOString()]], (err, results) => {
          if (err || !results || results.length === 0) {
            reject(err || new Error('OTP mail not found.'));
            return;
          }

          // 最新のUID（最も大きい数字）を見つける
          const latestUid = Math.max(...results);
          const f = imap.fetch([latestUid], { bodies: '' });
          f.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.once('end', () => {
                simpleParser(buffer, async (err, parsed) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  const otp = parsed.text?.match(/\d{6}/)?.[0];
                  if (otp) {
                    console.log('OTP found:', otp);
                    resolve(otp);
                  } else {
                    reject(new Error('OTP code not found in email body.'));
                  }
                  imap.end();
                });
              });
            });
          });
          f.once('error', (err) => {
            reject(err);
          });
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
}


/**
 * データをスクレイピングするためのクラス
 */
class Scraper {
  private browser: Browser;
  private context: BrowserContext;
  private page: Page;

  /**
   * @param browser PlaywrightのBrowserインスタンス
   * @param context PlaywrightのBrowserContextインスタンス
   * @param page PlaywrightのPageインスタンス
   */
  private constructor(browser: Browser, context: BrowserContext, page: Page) {
    this.browser = browser;
    this.context = context;
    this.page = page;
  }

  /**
   * Scraperのインスタンスを生成します。
   * @returns Scraperの新しいインスタンス
   */
  public static async create(): Promise<Scraper> {
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-gpu', '--no-sandbox'],
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    page.on('console', (msg) => console.log(msg.text()));
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    return new Scraper(browser, context, page);
  }

  /**
   * ブラウザを閉じて、リソースを解放します。
   */
  public async close() {
    await this.context.tracing.stop({ path: 'traces/trace.zip' });
    await this.browser.close();
  }

  /**
   * ログインします。
   */
  private async login() {
    // ログインページへ移動
    const url = 'https://id.moneyforward.com/sign_in';
    console.log(`goto ${url}...`);
    await Promise.all([
      this.page.goto(url),
      this.page.waitForTimeout(2000)
    ]);

    // メールアドレス入力
    await this.page.$('input[type=email]');
    console.log(`login...`);
    const {
      LOGIN_MAIL: mail,
      LOGIN_PASS: pass,
    } = process.env;
    await this.page.type('input[type=email]', mail || '', {
      delay: 10,
    });

    // メールアドレス送信
    console.log(`submit ${mail}...`);
    await this.page.click('button#submitto');
    await this.page.waitForSelector('input[type=password]', {
      timeout: 0,
    });

    // パスワード入力
    console.log(`submit pass...`);
    await this.page.type('input[type=password]', pass || '', {
      delay: 10,
    });
    await this.page.click('button#submitto');

    // 2段階認証
    await this.page.waitForTimeout(2000);

    const { MF_TOTP_SECRET } = process.env;

    // 認証アプリによる2段階認証
    if (MF_TOTP_SECRET) {
      const totp_elem = await this.page.$('input#otp_attempt');
      if (totp_elem) {
        try {
          console.log('Generating TOTP...');
          const token = authenticator.generate(MF_TOTP_SECRET);
          console.log(`submit totp...${token}`);
          await totp_elem.type(token, { delay: 10 });
          await this.page.click('button#submitto');
          return; // ログイン処理完了
        } catch (e) {
          console.error('Failed to generate or submit TOTP.', e);
          throw e;
        }
      }
    }

    // メールによる2段階認証
    const otp_elem = await this.page.$('input#email_otp');
    if (otp_elem) {
      try {
        console.log('Waiting for OTP from email...');
        const otp = await getOtpFromEmail();
        console.log(`submit otp...${otp}`);
        await otp_elem.type(otp, { delay: 10 });
        await this.page.click('button#submitto');
      } catch (e) {
        console.error('Failed to get OTP from email.', e);
        throw e;
      }
    }
  }

  /**
   * 株式情報を取得します。
   */
  public async fetchStock() {
    await this.login();
    const stocks = await this.getStockData();
    return { stocks };
  }

  /**
   * 残高の一括更新を実行します。
   */
  public async putUpdate() {
    await this.login();
    await this.updateAccounts();
    return;
  }

  /**
   * 資産ページのテーブルデータを取得します。
   */
  private async getStockData(): Promise<Record<string, string>[]> {
    const url = 'https://moneyforward.com/bs/portfolio';
    console.log(`goto ${url}...`);
    await this.page.goto(url, { timeout: 300000 });

    // アカウント選択画面が出る場合
    const text = await (await this.page.$('form[method=post]'))?.textContent() || '';
    if (text.includes(process.env.LOGIN_MAIL || '')) {
      await Promise.all([
        this.page.click('form[method=post] > button'),
        this.page.waitForSelector('table.table-eq', {
          timeout: 0,
        }),
      ]);
    } else {
      await Promise.all([
        this.page.click('button#submitto'),
        this.page.waitForSelector('table.table-eq', {
          timeout: 0,
        }),
      ]);
    }

    // テーブルデータを取得
    const data = await this.page.$$eval('table.table-eq tr', (rows) =>
      rows.map((row) =>
        Array.from(row.querySelectorAll('td, th'))
          .map((cell) => cell.textContent?.replace(/\n.+/, '').replace(/[円|+|%|倍|\r|\n]/g, '') || '')
      )
    );
    const [head, ...body] = data;
    const stocks = body.map((row) =>
      head.reduce((obj, key, i) => {
        obj[key] = row[i];
        return obj;
      }, {} as Record<string, string>)
    );
    console.log('stocks : ', stocks.length);
    return stocks;
  }

  /**
   * 口座残高の一括更新を実行します。
   */
  private async updateAccounts(): Promise<void> {
    const url = 'https://moneyforward.com/accounts';
    console.log(`goto ${url}...`);
    await this.page.goto(url, { timeout: 300000 });

    // アカウント選択画面が出る場合
    const text = await (await this.page.$('form[method=post]'))?.textContent() || '';
    if (text.includes(process.env.LOGIN_MAIL || '')) {
      await Promise.all([
        this.page.click('form[method=post] > button'),
        this.page.waitForSelector('p.aggregation-queue-all', {
          timeout: 0,
        }),
      ]);
    } else {
      await Promise.all([
        this.page.click('button#submitto'),
        this.page.waitForSelector('p.aggregation-queue-all', {
          timeout: 0,
        }),
      ]);
    }

    // 更新ボタンをクリック
    console.log(`click...`);
    await this.page.click('p.aggregation-queue-all > a');
    console.log('done!');
  }
}

export const fetchStockProc = async () => {
  const scraper = await Scraper.create();
  try {
    return await scraper.fetchStock();
  } finally {
    await scraper.close();
  }
};

export const putUpdateProc = async () => {
  const scraper = await Scraper.create();
  try {
    return await scraper.putUpdate();
  } finally {
    await scraper.close();
  }
};

