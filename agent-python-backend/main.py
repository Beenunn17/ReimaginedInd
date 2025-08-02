import os
from fastapi import FastAPI, WebSocket, Form, HTTPException, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from agents.seo_agent import generate_prompts_for_url, run_full_seo_analysis
import httpx

# --- App Configuration ---
app = FastAPI()
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = "us-central1"

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper Functions ---
async def find_sitemap(url: str, client: httpx.AsyncClient) -> dict:
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    parsed_url = httpx.URL(url)
    base_url = f"{parsed_url.scheme}://{parsed_url.host}"
    robots_url = f"{base_url}/robots.txt"
    
    try:
        response = await client.get(robots_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if response.status_code == 200:
            for line in response.text.splitlines():
                if line.lower().startswith('sitemap:'):
                    sitemap_url = line.split(':', 1)[1].strip()
                    return {"url": url, "status": "found", "sitemap_url": sitemap_url}
    except httpx.RequestError as e:
        print(f"Error fetching robots.txt for {url}: {e}")

    # If robots.txt fails or sitemap not in it, check common locations
    common_paths = ['/sitemap.xml', '/sitemap_index.xml']
    for path in common_paths:
        try:
            sitemap_url = f"{base_url}{path}"
            response = await client.head(sitemap_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
            if response.status_code == 200:
                return {"url": url, "status": "found", "sitemap_url": sitemap_url}
        except httpx.RequestError:
            continue
            
    return {"url": url, "status": "not_found", "sitemap_url": None}

# --- API Endpoints ---
@app.get("/")
def read_root():
    return {"message": "Braid AGENT v1.0"}

@app.post("/validate-sitemaps")
async def validate_sitemaps_endpoint(urls: list[str] = Form(...)):
    async with httpx.AsyncClient(follow_redirects=True) as client:
        results = [await find_sitemap(url, client) for url in urls]
    return {"results": results}

@app.post("/generate-prompts")
async def generate_prompts_endpoint(url: str = Form(...), competitors: str = Form(None)):
    if not PROJECT_ID:
        raise HTTPException(status_code=500, detail="Server configuration error: GCP Project ID not set.")
    try:
        # Pass competitors as a string, let the agent handle it.
        prompts = generate_prompts_for_url(url, competitors, PROJECT_ID, LOCATION)
        if "error" in prompts:
            raise HTTPException(status_code=500, detail=prompts["error"])
        return {"prompts": prompts}
    except Exception as e:
        # Catch any other unexpected errors
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@app.websocket("/ws/seo-analysis")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        your_site = data.get("yourSite")
        competitors = data.get("competitors", [])
        prompts = data.get("prompts")

        if not all([your_site, prompts, PROJECT_ID]):
            await websocket.send_json({"status": "error", "message": "Missing required data: site, prompts, or server config."})
            return

        final_report = await run_full_seo_analysis(websocket, PROJECT_ID, LOCATION, your_site, competitors, prompts)
        await websocket.send_json({"report": final_report})

    except WebSocketDisconnect:
        print("Client disconnected.")
    except Exception as e:
        error_message = f"An unexpected error occurred during analysis: {str(e)}"
        print(error_message)
        try:
            await websocket.send_json({"status": "error", "message": error_message})
        except RuntimeError:
            print("Could not send error to already closed socket.")
    finally:
        await websocket.close()