import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Button, Typography, Paper, Grid, TextField,
  CircularProgress, List, ListItem, ListItemText, ListItemIcon, Chip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import WarningIcon from '@mui/icons-material/Warning';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import SeoReportDashboard from './SeoReportDashboard';

function SEOptimizerPage() {
  const [yourSite, setYourSite] = useState('');
  const [competitorSites, setCompetitorSites] = useState('');
  const [prompts, setPrompts] = useState(null);
  const [sitemapStatus, setSitemapStatus] = useState([]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const ws = useRef(null);

  const handleAutoGeneratePrompts = async () => {
    if (!yourSite) {
      alert("Please enter your website URL first.");
      return;
    }
    setIsGeneratingPrompts(true);
    const formData = new FormData();
    formData.append('url', yourSite);
    formData.append('competitors', competitorSites);

    try {
      const response = await fetch('http://127.0.0.1:8000/generate-prompts', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to generate prompts.' }));
        throw new Error(errorData.detail || 'An unknown error occurred.');
      }
      const data = await response.json();
      setPrompts(data.prompts);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const handleValidateSitemaps = async () => {
    const allUrls = [yourSite, ...competitorSites.split(',').map(s => s.trim())].filter(Boolean);
    if (allUrls.length === 0) {
      alert("Please enter at least one website URL.");
      return;
    }
    setIsValidating(true);
    const formData = new FormData();
    allUrls.forEach(url => formData.append('urls', url));
    try {
      const response = await fetch('http://127.0.0.1:8000/validate-sitemaps', { method: 'POST', body: formData });
      if (!response.ok) { throw new Error('Failed to validate sitemaps.'); }
      const data = await response.json();
      setSitemapStatus(data.results);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleRunAnalysis = () => {
    if (!yourSite || !prompts) {
      alert("Please provide your site URL and generate prompts first.");
      return;
    }
    setIsLoading(true);
    setLogs([]);
    setAnalysisResult(null);

    ws.current = new WebSocket("ws://127.0.0.1:8000/ws/seo-analysis");

    ws.current.onopen = () => {
      console.log("WebSocket connected");
      ws.current.send(JSON.stringify({
        yourSite: yourSite,
        competitors: competitorSites.split(',').map(s => s.trim()).filter(Boolean),
        prompts: prompts
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === 'complete') {
        setAnalysisResult(data.report);
        setLogs(prevLogs => prevLogs.map(log => ({ ...log, status: 'success' })));
        setIsLoading(false);
        ws.current.close();
      } else if (data.status === 'error') {
        setLogs(prev => [...prev, { status: 'error', message: data.message }]);
        setIsLoading(false);
      } else {
        setLogs(prevLogs => {
          const updatedLogs = prevLogs.map((log, index) =>
            index === prevLogs.length - 1 ? { ...log, status: 'success' } : log
          );
          return [...updatedLogs, data];
        });
      }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setLogs(prev => [...prev, { status: 'error', message: 'A WebSocket connection error occurred.' }]);
      setIsLoading(false);
    };

    ws.current.onclose = () => {
      console.log("WebSocket disconnected");
      if (isLoading) {
        setIsLoading(false);
      }
    };
  };

  return (
    <Box sx={{ padding: { xs: 2, sm: 4 }, color: 'white' }}>
      <Typography variant="h4" component="h1" gutterBottom>LLM Optimization Agent</Typography>
      <Paper sx={{ p: { xs: 2, sm: 3 }, backgroundColor: '#1E1E1E', color: 'white' }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" component="h2" gutterBottom>1. Define Scope</Typography>
            <TextField label="Your Website URL" fullWidth margin="normal" value={yourSite} onChange={e => setYourSite(e.target.value)} />
            <TextField label="Competitor URLs (comma separated)" fullWidth margin="normal" value={competitorSites} onChange={e => setCompetitorSites(e.target.value)} />
            <Button variant="contained" startIcon={isValidating ? <CircularProgress size={20} /> : <TravelExploreIcon />} onClick={handleValidateSitemaps} disabled={isValidating || !yourSite}>Validate Sitemaps</Button>
            {sitemapStatus.length > 0 && (
              <Box sx={{ mt: 2 }}>{sitemapStatus.map((status, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2, mt: 1, borderColor: status.status === 'found' ? 'success.main' : 'warning.main' }}>
                  <Typography variant="subtitle2">{status.url}</Typography>
                  {status.status === 'found' ? (<Typography color="success.main" variant="body2">✅ Sitemap Found: {status.sitemap_url}</Typography>) : (<TextField label="Sitemap URL Not Found - Please provide manually" fullWidth size="small" margin="dense" />)}
                </Paper>
              ))}</Box>
            )}
            <Typography variant="h6" component="h2" sx={{ mt: 3 }} gutterBottom>2. Authority Analysis Prompts</Typography>
            <TextField
              label="Prompts will appear here after generation"
              fullWidth
              multiline
              rows={5}
              margin="normal"
              value={prompts ? Object.values(prompts).flat().join('\n') : ''}
              InputProps={{ readOnly: true }}
            />
            <Button variant="outlined" size="small" startIcon={isGeneratingPrompts ? <CircularProgress size={16} /> : <AutoFixHighIcon />} onClick={handleAutoGeneratePrompts} disabled={isGeneratingPrompts || !yourSite}>{isGeneratingPrompts ? 'Generating...' : 'Auto-Generate Prompts'}</Button>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" component="h2" gutterBottom>Agent Status & Results</Typography>
            <Paper variant="outlined" sx={{ p: 2, minHeight: '300px', backgroundColor: '#0d1117' }}>
              <List dense>{logs.map((log, index) => (
                <ListItem key={index}>
                  <ListItemIcon sx={{ minWidth: '32px' }}>
                    {log.status === 'success' ? <CheckCircleIcon color="success" fontSize="small" /> : log.status === 'error' ? <WarningIcon color="error" fontSize="small" /> : <CircularProgress color="inherit" size={16} />}
                  </ListItemIcon>
                  <ListItemText primary={log.message} />
                </ListItem>
              ))}</List>
              {isLoading && logs.length === 0 && <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>}
            </Paper>
            <Button variant="contained" color="primary" fullWidth sx={{ mt: 2, py: 1.5 }} onClick={handleRunAnalysis} disabled={isLoading || !yourSite}>
              {isLoading ? 'Analysis in Progress...' : 'Run Full Analysis'}
            </Button>
          </Grid>
        </Grid>

        {analysisResult && prompts && (
          <SeoReportDashboard report={analysisResult} originalPrompts={prompts} />
        )}

      </Paper>
    </Box>
  );
}

export default SEOptimizerPage;