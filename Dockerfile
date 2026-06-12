FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы пакетов
COPY package.json package-lock.json ./

# Устанавливаем зависимости
RUN npm install --production

# Копируем исходный код
COPY worker.js .

# Команда для запуска воркера
CMD ["node", "worker.js"]
