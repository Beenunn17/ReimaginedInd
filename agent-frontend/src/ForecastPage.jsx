import React, { useState, useEffect } from 'react';
import { Button, Card, CardContent, Typography, CircularProgress, Box, Paper, Select, MenuItem, FormControl, InputLabel, TextField } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// DEFINE THE API BASE URL AT THE TOP
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

function ForecastPage() {
    const [availableDatasets, setAvailableDatasets] = useState([]);
    const [selectedDataset, setSelectedDataset] = useState(null);
    const [dataPreview, setDataPreview] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [followUpQuestion, setFollowUpQuestion] = useState("");
    const [conversationHistory, setConversationHistory] = useState([]);

    useEffect(() => {
        // Fetch available datasets on component mount
        fetch(`${API_BASE_URL}/datasets`)
            .then(res => res.json())
            .then(data => setAvailableDatasets(data))
            .catch(err => console.error("Failed to fetch datasets:", err));
    }, []);

    useEffect(() => {
        // Fetch data preview when a dataset is selected
        if (selectedDataset) {
            setDataPreview(null);
            fetch(`${API_BASE_URL}/preview/${selectedDataset.filename}`)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => setDataPreview(data))
                .catch(err => {
                    console.error("Failed to fetch data preview:", err);
                    setError("Could not load data preview. Please check the backend connection.");
                });
        }
    }, [selectedDataset]);

    const handleAnalysis = async () => {
        if (!selectedDataset) {
            setError("Please select a dataset first.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setConversationHistory([]);

        const formData = new FormData();
        formData.append('filename', selectedDataset.filename);

        try {
            const response = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                throw new Error(`Analysis request failed: ${response.statusText}`);
            }
            const data = await response.json();
            setAnalysisResult(data);
            const agentMessage = { type: 'agent', content: data.text, plot_path: data.plot_path };
            setConversationHistory([agentMessage]);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFollowUpSubmit = async (e) => {
        e.preventDefault();
        if (!followUpQuestion.trim()) return;

        setIsLoading(true);
        const userMessage = { type: 'user', content: followUpQuestion };
        const currentConversation = [...conversationHistory, userMessage];
        setConversationHistory(currentConversation);

        const formData = new FormData();
        formData.append('question', followUpQuestion);
        // Pass the conversation history *without* any plot paths from previous turns
        const historyForBackend = conversationHistory.map(({type, content}) => ({type, content}));
        formData.append('conversation', JSON.stringify(historyForBackend));

        try {
            const response = await fetch(`${API_BASE_URL}/follow-up`, {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                throw new Error(`Follow-up request failed: ${response.statusText}`);
            }
            const data = await response.json();
            const agentMessage = { type: 'agent', content: data.text, plot_path: data.plot_path };
            setConversationHistory(prev => [...prev, agentMessage]);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
            setFollowUpQuestion("");
        }
    };
    
    const handleDatasetChange = (event) => {
        const file = availableDatasets.find(d => d.filename === event.target.value);
        setSelectedDataset(file);
    };

    const renderPlot = (plotPath) => {
        // Construct the full URL for the plot image
        const plotUrl = `${API_BASE_URL}/${plotPath}`;
        // Find the latest plot in the history to display
        if(plotPath.endsWith('.html')) {
             return (
                <iframe
                    src={plotUrl}
                    style={{ width: '100%', height: '500px', border: 'none' }}
                    title="Analysis Plot"
                />
            );
        } else {
            return (
                 <img src={plotUrl} alt="Analysis Plot" style={{ maxWidth: '100%', height: 'auto', marginTop: '20px' }} />
            )
        }
    };
    
    // Find the latest plot path from the conversation history
    const latestPlotPath = [...conversationHistory].reverse().find(msg => msg.type === 'agent' && msg.plot_path)?.plot_path;


    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Data Analysis & Forecasting Agent
            </Typography>

            <Paper sx={{ p: 2, mb: 3 }}>
                <FormControl fullWidth>
                    <InputLabel id="dataset-select-label">Select Dataset</InputLabel>
                    <Select
                        labelId="dataset-select-label"
                        value={selectedDataset ? selectedDataset.filename : ''}
                        label="Select Dataset"
                        onChange={handleDatasetChange}
                    >
                        {availableDatasets.map((ds) => (
                            <MenuItem key={ds.filename} value={ds.filename}>
                                {ds.filename}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Button
                    variant="contained"
                    onClick={handleAnalysis}
                    disabled={isLoading || !selectedDataset}
                    sx={{ mt: 2 }}
                >
                    Analyze Dataset
                </Button>
            </Paper>

            {isLoading && <CircularProgress sx={{ display: 'block', margin: 'auto' }} />}
            {error && <Typography color="error">{error}</Typography>}

            {dataPreview && !conversationHistory.length && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6">Data Preview</Typography>
                        <pre style={{ overflowX: 'auto' }}>{JSON.stringify(dataPreview.head, null, 2)}</pre>
                    </CardContent>
                </Card>
            )}

            {conversationHistory.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h6">Analysis Conversation</Typography>
                        <Box sx={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ccc', p: 2, mb: 2, borderRadius: '4px' }}>
                            {conversationHistory.map((msg, index) => (
                                <Box key={index} sx={{ mb: 1, color: msg.type === 'user' ? 'primary.main' : 'text.primary' }}>
                                    <Typography variant="subtitle2"><strong>{msg.type === 'user' ? 'You' : 'Agent'}:</strong></Typography>
                                    <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Typography>
                                </Box>
                            ))}
                        </Box>

                        {latestPlotPath && (
                             <Box my={2}>
                                {renderPlot(latestPlotPath)}
                            </Box>
                        )}
                        
                        <form onSubmit={handleFollowUpSubmit}>
                            <TextField
                                fullWidth
                                label="Ask a follow-up question"
                                value={followUpQuestion}
                                onChange={(e) => setFollowUpQuestion(e.target.value)}
                                variant="outlined"
                                disabled={isLoading}
                            />
                            <Button type="submit" variant="contained" sx={{ mt: 1 }} disabled={isLoading}>
                                Send
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}

export default ForecastPage;