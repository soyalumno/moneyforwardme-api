import express from 'express';
import { fetchStockProc, putUpdateProc } from './scraper.js';

const app = express();

/**
 * 秘密鍵をチェックするExpressミドルウェア
 * @param req Expressリクエストオブジェクト
 * @param res Expressレスポンスオブジェクト
 * @param next Express next関数
 */
const checkSecretKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // 秘密鍵のチェック（開発モードではスキップ）
  if (process.env.NODE_ENV !== 'development') {
    const secretKey = req.headers['x-secret-key'];
    if (!secretKey || secretKey !== process.env.SECRET_KEY) {
      console.error('Invalid secret key');
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
  }
  next();
};

/**
 * 株式データ取得
 */
app.get('/stocks', checkSecretKey, async (req, res) => {
  try {
    console.log('[Request] /stocks', req.query);
    const result = await fetchStockProc();
    res.json({
      result: 'ok',
      query: req.query,
      content: result,
    });
  } catch (err) {
    console.error('[Error]', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/**
 * 残高更新
 */
app.get('/update', checkSecretKey, async (req, res) => {
  try {
    console.log('[Request] /update', req.query);
    const result = await putUpdateProc();
    res.json({
      result: 'ok',
      query: req.query,
      content: result,
    });
  } catch (err) {
    console.error('[Error]', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// 他のパスは 404
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// サーバ起動
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

