# Use the original, working Python runtime
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install the Python dependencies AND the Playwright browser dependencies
# This is the critical line that was missing.
RUN pip install --no-cache-dir -r requirements.txt && \
    playwright install --with-deps chromium

# Copy the rest of the application's code into the container
COPY . .

# ADD THIS LINE to create the data files inside the container
RUN python create_dummy_data.py

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run the uvicorn server, using the $PORT variable provided by Cloud Run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]