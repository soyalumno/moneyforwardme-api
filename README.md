# Money Forward Stock Scraper on Cloud Run

このプロジェクトは、マネーフォワード ME から株式ポートフォリオ情報を取得するウェブスクレイピングアプリケーションです。Node.js 上で動作し、ブラウザ自動化のために Playwright を使用します。このアプリケーションは、Google Cloud Run にデプロイされるように設計されています。

## 特徴

- **ウェブスクレイピング**: マネーフォワード ME にログインし、株式ポートフォリオページをスクレイピングします。
- **OTP処理**: ログイン時にメールで送信されるワンタイムパスワード（OTP）を（IMAP経由で）自動的に取得します。**注意:** 認証アプリなど、メールOTP以外の方法による二段階認証が有効になっているアカウントでは利用できません。
- **APIサーバー**: Express.js を使用して、スクレイピングをトリガーし、データを取得するためのシンプルなRESTful APIエンドポイントを提供します。
- **コンテナ化**: 簡単なセットアップとデプロイのために `Dockerfile` と `docker-compose.yml` が含まれています。
- **Cloud Run対応**: デプロイスクリプトを含め、Google Cloud Run へのデプロイに最適化されています。

## 技術スタック

- **バックエンド**: Node.js, Express.js, TypeScript
- **スクレイピング**: Playwright
- **メール**: node-imap, mailparser
- **コンテナ**: Docker

---

## APIエンドポイント

すべてのリクエストにおいて、`x-secret-key` ヘッダーにシークレットキーを提供する必要があります。

- `GET /stocks`
  - スクレイピングプロセスをトリガーし、株式ポートフォリオデータをJSONレスポンスとして返します。

- `GET /update`
  - マネーフォワード ME の口座残高更新プロセスをトリガーします。

## 前提条件

- Node.js (v18.0.0 以降)
- Docker
- Google Cloud SDK (gcloudデプロイ用)

## 環境変数

ルートディレクトリに `.env` ファイルを作成し、以下の変数を追加してください。このファイルはローカル開発で使用され、値はクラウドデプロイ時に渡されます。

```env
# API認証用のシークレットキー
SECRET_KEY=your_secret_key

# マネーフォワードのログイン情報
LOGIN_MAIL=your_moneyforward_email@example.com
LOGIN_PASS=your_moneyforward_password

# OTPメール読み取り用のIMAP設定
IMAP_USER=your_email_for_otp@example.com
IMAP_PASSWORD=your_email_app_password
IMAP_HOST=imap.example.com
IMAP_PORT=993

# マネーフォワードから送信されるOTPメールの「From」アドレス
MF_EMAIL_FROM=do_not_reply@moneyforward.com
```

**注意**: Gmailの場合、IMAPで使用するために「アプリパスワード」を作成する必要がある場合があります。

## ローカル開発

1.  **依存関係のインストール:**
    ```bash
    npm install
    ```

2.  **開発サーバーの実行:**
    サーバーは `http://localhost:8080` で起動します。
    ```bash
    npm run dev
    ```

3.  **リクエストの送信:**
    ```bash
    curl -X GET http://localhost:8080/stocks -H "x-secret-key: your_secret_key"
    ```

## Docker

Docker Compose を使用してアプリケーションを実行することもできます。

1.  **コンテナのビルドと実行:**
    ```bash
    docker-compose up --build
    ```

2.  **リクエストの送信:**
    ```bash
    curl -X GET http://localhost:8080/stocks -H "x-secret-key: your_secret_key"
    ```

## Google Cloud Runへのデプロイ

このプロジェクトは、Google Cloud Runへ簡単にデプロイできます。

1.  **gcloud CLIの設定:**
    デプロイする前に、`gcloud`コマンドラインツールで認証とプロジェクト設定が完了していることを確認してください。
    ```bash
    # Googleアカウントで認証
    gcloud auth login

    # 使用するGCPプロジェクトを設定
    gcloud config set project YOUR_PROJECT_ID
    ```

2.  **環境変数の確認:**
    プロジェクトのルートにある`.env`ファイルに、デプロイに必要な全ての環境変数が正しく設定されていることを確認してください。「環境変数」のセクションを参照してください。

3.  **デプロイの実行:**
    以下のコマンドを実行すると、`deploy.sh`スクリプトが`.env`ファイルから環境変数を読み込み、自動的にデプロイプロセスを開始します。
    ```bash
    npm run deploy:gcloud
    ```
