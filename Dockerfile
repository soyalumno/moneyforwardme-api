# ベースイメージ
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# 作業ディレクトリ作成
WORKDIR /app

# 依存ファイルを先にコピーして install（キャッシュ効率化）
COPY package*.json ./
RUN npm install

# ソースと tsconfig をコピー
COPY . .

# TypeScript をビルド
RUN npm ci && npm run build

# Cloud Run はPORT環境変数を使う
ENV PORT=8080

# エクスポートするポート
EXPOSE 8080

# アプリ起動
CMD ["npm", "start"]
