import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box, Button, Typography, Paper, Grid, TextField, CircularProgress, List, ListItem, ListItemText,
  ListItemIcon, Accordion, AccordionSummary, AccordionDetails, Alert
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import WarningIcon from '@mui/icons-material/Warning';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ScienceIcon from '@mui/icons-material/Science';
import PageviewIcon from '@mui/icons-material/Pageview';
import ContentPasteSearchIcon from '@mui/icons-material/ContentPasteSearch';

// Best practice: Store API base URL in environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';


// --- Sub-Component for Scope Input & Sitemap Validation ---
const ScopeSection = ({ yourSite, setYourSite, competitorSites, setCompetitorSites, onValidate, isValidating, sitemapStatus, setSitemapStatus }) => {

  const handleManualSitemapChange = (index, value) => {
    const newStatus = [...sitemapStatus];
    newStatus[index].manual_sitemap_url = value;
    // We can also add logic here to mark it as 'provided'
    // newStatus[index].status = 'provided'; 
    setSitemapStatus(newStatus);
  };

  return (
    <>
      <Typography variant="h6" component="h2" gutterBottom>1. Define Scope</Typography>
      <TextField
        label="Your Website URL"
        fullWidth
        margin="normal"
        value={yourSite}
        onChange={e => setYourSite(e.target.value)}
        placeholder="https://www.your-example.com"
      />
      <TextField
        label="Competitor URLs (comma separated)"
        fullWidth
        margin="normal"
        value={competitorSites}
        onChange={e => setCompetitorSites(e.target.value)}
        placeholder="https://www.competitor-a.com, https://www.competitor-b.com"
      />
      <Button
        variant="contained"
        startIcon={isValidating ? <CircularProgress size={20} /> : <TravelExploreIcon />}
        onClick={onValidate}
        disabled={isValidating || !yourSite}
      >
        Validate Sitemaps
      </Button>
      {sitemapStatus.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {sitemapStatus.map((status, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2, mt: 1, borderColor: status.status === 'found' ? 'success.main' : 'warning.main' }}>
              <Typography variant="subtitle2" sx={{ wordBreak: 'break-all' }}>{status.url}</Typography>
              {status.status === 'found' ? (
                <Typography color="success.main" variant="body2">✅ Sitemap Found: {status.sitemap_url}</Typography>
              ) : (
                <TextField
                  label="Sitemap URL Not Found - Please provide manually"
                  fullWidth
                  size="small"
                  margin="dense"
                  value={status.manual_sitemap_url || ''}
                  onChange={(e) => handleManualSitemapChange(index, e.target.value)}
                  placeholder="https://www.your-example.com/sitemap.xml"
                />
              )}
            </Paper>
          ))}
        </Box>
      )}
    </>
  );
};

// --- Sub-Component for Prompt Generation ---
const PromptSection = ({ prompts, onGenerate, isGenerating, error }) => (
  <>
    <Typography variant="h6" component="h2" sx={{ mt: 3 }} gutterBottom>2. Authority Analysis Prompts</Typography>
    <Button
      variant="outlined"
      size="small"
      startIcon={isGenerating ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
      onClick={onGenerate}
      disabled={isGenerating}
    >
      {isGenerating ? 'Generating...' : 'Auto-Generate Prompts'}
    </Button>

    {prompts && (
      <Box sx={{ mt: 2, maxHeight: '300px', overflowY: 'auto' }}>
        {Object.entries(prompts).map(([category, promptList]) => (
          <Accordion key={category} defaultExpanded sx={{ backgroundColor: '#2a2a2a', color: 'white' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />}>
              <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>{category.replace(/_/g, ' ')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {promptList.map((prompt, index) => (
                  <ListItem key={index}><ListItemText primary={`- ${prompt}`} /></ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    )}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
  </>
);

// --- Sub-Component for Final Report Display ---
const ReportDisplay = ({ result }) => {
    if (!result) return null;
    
    // Helper to render report sections
    const renderSection = (title, data, icon) => (
      <Grid item xs={12} md={6} key={title}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
             {icon} <Typography sx={{ml: 1, fontWeight: 'bold'}}>{title}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* This assumes data is an array of strings or objects with a 'point' property */}
            {Array.isArray(data) ? (
              <List dense>
                {data.map((item, index) => <ListItem key={index}><ListItemText primary={item.point || item} /></ListItem>)}
              </List>
            ) : (
              <Typography variant="body2">{typeof data === 'object' ? JSON.stringify(data, null, 2) : data}</Typography>
            )}
          </AccordionDetails>
        </Accordion>
      </Grid>
    );

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h5" component="h3" gutterBottom>{result.reportTitle || 'Final Analysis Report'}</Typography>
            <Grid container spacing={2}>
              {result.keyword_gap_analysis && renderSection("Keyword Gap Analysis", result.keyword_gap_analysis, <TravelExploreIcon color="primary"/>)}
              {result.on_page_seo_audit && renderSection("On-Page SEO Audit", result.on_page_seo_audit, <PageviewIcon color="primary"/>)}
              {result.content_recommendations && renderSection("Content Recommendations", result.content_recommendations, <ContentPasteSearchIcon color="primary"/>)}
              {/* Add other sections as they become available in the report */}
            </Grid>
        </Box>
    )
};


// --- Main Page Component ---
function SEOptimizerPage() {
  // State
  const [yourSite, setYourSite] = useState('');
  const [competitorSites, setCompetitorSites] = useState('');
  const [prompts, setPrompts] = useState(null);
  const [sitemapStatus, setSitemapStatus] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // Loading and Error States
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const ws = useRef(null);
  
  // Memoize competitor URLs to avoid re-calculating on every render
  const competitorUrlList = useMemo(() => 
    competitorSites.split(',').map(s => s.trim()).filter(Boolean),
    [competitorSites]
  );
  
  // CRITICAL: Add cleanup effect for WebSocket
  useEffect(() => {
    // This function will be called when the component unmounts
    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.log("Closing WebSocket connection on component unmount.");
        ws.current.close();
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

  const handleValidateSitemaps = async () => {
    const allUrls = [yourSite, ...competitorUrlList].filter(Boolean);
    if (allUrls.length === 0) {
      setError("Please enter at least one website URL.");
      return;
    }
    setIsValidating(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/validate-sitemaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: allUrls })
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      // Initialize manual_sitemap_url for fields that will need it
      const resultsWithManualField = data.results.map(r => ({...r, manual_sitemap_url: ''}));
      setSitemapStatus(resultsWithManualField);
    } catch (e) {
      setError(`Failed to validate sitemaps: ${e.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleAutoGeneratePrompts = async () => {
    if (!yourSite) { setError("Please enter your website URL first."); return; }
    setIsGeneratingPrompts(true);
    setError(null);
    setPrompts(null); // Clear old prompts
    try {
      const response = await fetch(`${API_BASE_URL}/generate-prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: yourSite })
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setPrompts(data.prompts);
    } catch (e) {
      setError(`Failed to generate prompts: ${e.message}`);
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    setLogs([]);
    setAnalysisResult(null);
    setError(null);

    ws.current = new WebSocket(`wss://${API_BASE_URL.replace(/^https?:\/\//, '')}/ws/seo-analysis`);

    ws.current.onopen = () => {
      console.log("WebSocket connected");
      
      // Construct payload with manually provided sitemaps if available
      const getSitemapForUrl = (url) => {
        const status = sitemapStatus.find(s => s.url === url);
        if (!status) return null;
        return status.manual_sitemap_url || status.sitemap_url || null;
      }
      
      const payload = {
        yourSite: { url: yourSite, sitemap: getSitemapForUrl(yourSite) },
        competitors: competitorUrlList.map(url => ({ url, sitemap: getSitemapForUrl(url) })),
        prompts: prompts
      };
      
      ws.current.send(JSON.stringify(payload));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.log) {
        setLogs(prevLogs => [...prevLogs, { status: 'running', message: data.log, timestamp: new Date() }]);
      } else if (data.report) {
        setAnalysisResult(data.report);
        setLogs(prevLogs => [...prevLogs, { status: 'success', message: "Analysis complete! Report generated.", timestamp: new Date() }]);
        setIsAnalyzing(false);
        ws.current.close();
      } else if (data.error) {
         setError(`An analysis error occurred: ${data.error}`);
         setLogs(prevLogs => [...prevLogs, { status: 'error', message: data.error, timestamp: new Date() }]);
         setIsAnalyzing(false);
      }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError('A WebSocket connection error occurred. Check the console and ensure the backend is running.');
      setIsAnalyzing(false);
    };

    ws.current.onclose = (event) => {
      console.log("WebSocket disconnected", event.reason);
      setIsAnalyzing(false); // Ensure loading state is always turned off
    };
  };

  return (
    <Box sx={{ padding: { xs: 2, sm: 4 }, color: 'white', maxWidth: '1200px', margin: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>LLM Optimization Agent</Typography>
      
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: { xs: 2, sm: 3 }, backgroundColor: '#1E1E1E', color: 'white' }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <ScopeSection
              yourSite={yourSite}
              setYourSite={setYourSite}
              competitorSites={competitorSites}
              setCompetitorSites={setCompetitorSites}
              onValidate={handleValidateSitemaps}
              isValidating={isValidating}
              sitemapStatus={sitemapStatus}
              setSitemapStatus={setSitemapStatus}
            />
            <PromptSection
              prompts={prompts}
              onGenerate={handleAutoGeneratePrompts}
              isGenerating={isGeneratingPrompts}
              error={!prompts && error} // Pass down error if prompt generation failed
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="h6" component="h2" gutterBottom>3. Agent Status & Results</Typography>
            <Paper variant="outlined" sx={{ p: 2, height: '400px', backgroundColor: '#0d1117', overflowY: 'auto' }}>
              <List dense>
                {logs.length === 0 && !isAnalyzing && <ListItemText primary="Logs will appear here once the analysis begins." sx={{color: 'grey.500'}}/>}
                {isAnalyzing && logs.length === 0 && <Box sx={{display:'flex', justifyContent:'center'}}><CircularProgress/></Box>}
                {logs.map((log, index) => (
                  <ListItem key={log.timestamp.getTime() + index}>
                    <ListItemIcon sx={{ minWidth: '32px' }}>
                      {log.status === 'success' ? <CheckCircleIcon color="success" fontSize="small" /> 
                       : log.status === 'error' ? <WarningIcon color="error" fontSize="small" /> 
                       : <CircularProgress color="inherit" size={16} />}
                    </ListItemIcon>
                    <ListItemText primary={log.message} />
                  </ListItem>
                ))}
              </List>
            </Paper>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2, py: 1.5, fontSize: '1rem' }}
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || !yourSite || !prompts}
              startIcon={isAnalyzing ? <CircularProgress color="inherit" size={24} /> : <ScienceIcon />}
            >
              {isAnalyzing ? 'Analysis in Progress...' : 'Run Full Analysis'}
            </Button>
          </Grid>
        </Grid>

        <ReportDisplay result={analysisResult} />
      </Paper>
    </Box>
  );
}

export default SEOptimizerPage;