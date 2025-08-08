import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, Paper, Grid, TextField, CircularProgress, Link, Chip, List, ListItem, ListItemIcon, ListItemText, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButtonGroup, ToggleButton } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// --- A dedicated component to render the beautiful report ---
const AnalysisReport = ({ result }) => {
  if (!result) return null;
  if (result.error) {
    return <Typography color="error" sx={{ mt: 2 }}>Error: {result.error}</Typography>;
  }

  return (
    <Paper sx={{ p: 3, backgroundColor: '#2a2a2a', mt: 2, border: '1px solid rgba(255,255,255,0.23)' }}>
      <Typography variant="h5" component="h3" gutterBottom fontWeight="bold">{result.reportTitle}</Typography>
      
      <Box sx={{ my: 3 }}>
        <Typography variant="h6" gutterBottom>Key Insights</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {result.keyInsights?.map((item, index) => (
            <Chip key={index} label={`${item.insight} (${item.metric})`} variant="outlined" />
          ))}
        </Box>
      </Box>

      {result.visualization && (
        <Box sx={{ my: 3 }}>
          <img src={result.visualization} alt="Analysis Plot" style={{ width: '100%', borderRadius: '8px', padding: '10px', backgroundColor: '#333' }} />
        </Box>
      )}

      <Box sx={{ my: 3 }}>
        <Typography variant="h6" gutterBottom>Summary</Typography>
        <Typography variant="body1" color="text.secondary">{result.summary}</Typography>
      </Box>

      {result.recommendations && (
        <Box sx={{ my: 3 }}>
          <Typography variant="h6" gutterBottom>Recommendations</Typography>
          <List>
            {result.recommendations.map((rec, index) => (<ListItem key={index} disableGutters><ListItemIcon sx={{ minWidth: '32px' }}><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon><ListItemText primary={rec} /></ListItem>))}
          </List>
        </Box>
      )}
    </Paper>
  );
};

// --- A component to render a preview of the data ---
const DataPreview = ({ data }) => {
  if (!data || !data.columns || !data.data) return <Box sx={{display: 'flex', justifyContent: 'center', my:2}}><CircularProgress size={24} /></Box>;
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, backgroundColor: '#0d1117' }}>
      <Table size="small">
        <TableHead>
          <TableRow>{data.columns.map(col => <TableCell key={col} sx={{ fontWeight: 'bold' }}>{col}</TableCell>)}</TableRow>
        </TableHead>
        <TableBody>
          {data.data.map((row, rowIndex) => (<TableRow key={rowIndex}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const datasets = [
  { title: "Marketing Mix Model (Advanced)", filename: "mmm_advanced_data.csv", description: "Run a Bayesian MMM on a rich dataset with 10+ channels.", schemaDescription: `3 years of weekly data for sales, 10+ media channels, and external factors like competitor spend and inflation.` },
  { title: "Customer Churn", filename: "customer_churn.csv", description: "Analyze features affecting customer retention.", schemaDescription: `A table of customer data including: CustomerID, TenureMonths, MonthlyCharge, FeaturesUsed, SupportTickets, and Churn.`, samplePrompt: `Which features are the strongest predictors of customer churn? Show a feature importance plot.` },
  { title: "Campaign Performance", filename: "campaign_performance.csv", description: "Optimize marketing spend and conversion rates.", schemaDescription: `Marketing campaign performance data including: Date, CampaignID, Impressions, Clicks, Spend, and Conversions.`, samplePrompt: `What is the return on ad spend (ROAS) for each campaign? Calculate ROAS as (Conversions * 50) / Spend.` },
  { title: "Retail Sales", filename: "retail_sales.csv", description: "In-depth transactional data for sales analysis.", schemaDescription: `Transactional sales data including: Date, SKU, ProductName, Category, Cost, Sales, Profit, Promotion, Weather, and Holiday.`, samplePrompt: `What is the correlation between weather and sales of hockey sticks? Plot the results.` },
];

function ForecastPage() {
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [dataPreview, setDataPreview] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [revenueTarget, setRevenueTarget] = useState('3000000');
  
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpHistory, setFollowUpHistory] = useState([]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const followUpEndRef = useRef(null);

  useEffect(() => {
    if (followUpEndRef.current) {
      followUpEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [followUpHistory, isFollowUpLoading]);

  useEffect(() => {
    if (selectedDataset) {
      setDataPreview(null);
      fetch(`${API_BASE_URL}/preview/${selectedDataset.filename}`)
        .then(res => res.json())
        .then(data => setDataPreview(data))
        .catch(err => console.error("Failed to fetch data preview:", err));
    }
  }, [selectedDataset]);

  const handleDatasetSelect = (dataset) => {
    setSelectedDataset(dataset);
    setAnalysisResult(null);
    setFollowUpHistory([]);
    setPrompt(dataset.samplePrompt || ''); // Set prompt if it exists
    setRevenueTarget('3000000');
  };

  const handleAnalysis = async () => {
    if (!selectedDataset) return;
    setIsLoading(true);
    setAnalysisResult(null);
    setFollowUpHistory([]);

    const formData = new FormData();
    formData.append('dataset_filename', selectedDataset.filename);
    
    // Determine which model to use and what data to send
    const isMMM = selectedDataset.filename.includes('mmm_advanced');
    formData.append('model_type', isMMM ? 'bayesian' : 'standard');
    
    if (isMMM) {
      formData.append('revenue_target', revenueTarget || '0');
      // For MMM, we can use a default prompt since the agent is specialized
      formData.append('prompt', 'Run a full Bayesian MMM analysis.');
    } else {
      formData.append('prompt', prompt);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, { method: 'POST', body: formData });
      if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
      const data = await response.json();
      setAnalysisResult(data);
    } catch (error) {
      setAnalysisResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUpSubmit = async (e) => {
    // This function remains the same
    e.preventDefault();
    if (!followUpInput.trim()) return;
    // ... (rest of the function is unchanged)
  };

  return (
    <Box sx={{ padding: { xs: 2, sm: 4 }, color: 'white' }}>
      <Typography variant="h4" component="h1" gutterBottom>Data Science Agent</Typography>
      <Paper sx={{ p: { xs: 2, sm: 3 }, backgroundColor: '#1E1E1E', color: 'white' }}>
        
        <Typography variant="h6" component="h2" gutterBottom>1. Select a Dataset</Typography>
        <Grid container spacing={2}>
          {datasets.map((ds) => (<Grid item key={ds.filename} xs={12} md={6} lg={3}><Paper variant="outlined" onClick={() => handleDatasetSelect(ds)} sx={{ p: 2, cursor: 'pointer', height: '100%', borderColor: selectedDataset?.filename === ds.filename ? 'primary.main' : 'rgba(255,255,255,0.23)', transform: selectedDataset?.filename === ds.filename ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s ease-in-out', backgroundColor: selectedDataset?.filename === ds.filename ? '#2a2a2a' : 'transparent', }}><Typography variant="subtitle1" fontWeight="bold">{ds.title}</Typography><Typography variant="body2" color="text.secondary">{ds.description}</Typography></Paper></Grid>))}
        </Grid>

        {selectedDataset && (
          <>
            <Paper sx={{ mt: 4, p: 2, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.23)' }}>
              <Typography variant="subtitle1" fontWeight="bold">Dataset Details: {selectedDataset.title}</Typography>
              <DataPreview data={dataPreview} />
            </Paper>

            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" component="h2" gutterBottom>2. Ask a Question</Typography>
              
              {selectedDataset.filename.includes('mmm_advanced') ? (
                  <TextField label="Next Quarter's Revenue Target ($)" type="number" variant="outlined" fullWidth margin="normal" value={revenueTarget} onChange={(e) => setRevenueTarget(e.target.value)} />
              ) : (
                  <TextField label="What would you like to know about this data?" variant="outlined" fullWidth multiline rows={4} margin="normal" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading} />
              )}

              <Button variant="contained" color="primary" onClick={handleAnalysis} disabled={isLoading}>{isLoading ? 'Analyzing...' : 'Run Analysis'}</Button>
            </Box>
          </>
        )}

        <Box sx={{ marginTop: 4 }}>
          <Typography variant="h6" component="h3">Results</Typography>
          {isLoading && !isFollowUpLoading ? (<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}><CircularProgress /></Box>) : (analysisResult && <AnalysisReport result={analysisResult} />)}
          
          {analysisResult && !analysisResult.error && (
            <Paper sx={{ p: 2, mt: 4, backgroundColor: '#2a2a2a', border: '1px solid rgba(255,255,255,0.23)' }}>
              <Typography variant="h6" gutterBottom><QuestionAnswerIcon sx={{verticalAlign: 'middle', mr: 1}}/>Follow-up Questions</Typography>
              <Box component="form" onSubmit={handleFollowUpSubmit} className="message-form-container" sx={{mt: 2, p:0}}>
                <TextField fullWidth variant="outlined" placeholder="Ask a follow-up question..." value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)} autoComplete="off" />
                <Button type="submit" variant="contained">Send</Button>
              </Box>
            </Paper>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default ForecastPage;