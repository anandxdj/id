FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod=false

COPY . .

EXPOSE 4000

CMD ["pnpm", "start"]
