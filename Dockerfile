# 1. Use an official Node.js runtime as the base image
FROM node:14

# 2. Set the working directory in the container
WORKDIR /usr/src/app

# 3. Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy the rest of your application code to the working directory
COPY . .

# 6. Expose the port your app will run on (Cloud Run expects it to be 8080)
EXPOSE 8080

# 7. Start the application
CMD ["npm", "start"]