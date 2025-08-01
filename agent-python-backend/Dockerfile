# Stage 1: Use a standard Python image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's code into the container
COPY . .

# Run the script to create the dummy CSV files inside the container
RUN python create_dummy_data.py

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Command to run the application using Gunicorn, listening on the port provided by Cloud Run
CMD exec gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind "0.0.0.0:$PORT"