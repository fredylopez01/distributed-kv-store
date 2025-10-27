FROM nginx:alpine

# Copy the HTML file
COPY index.html /usr/share/nginx/html/

# Copy the JavaScript file
COPY app.js /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
