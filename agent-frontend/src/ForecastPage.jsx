import React, { useState, useEffect } from 'react';
import { Button, Card, CardContent, Typography, TextField, CircularProgress, Box, Paper, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
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
            setConversationHistory([{ type: 'agent', content: data.text }]);
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
        setConversationHistory(prev => [...prev, userMessage]);

        const formData = new FormData();
        formData.append('question', followUpQuestion);
        formData.append('conversation', JSON.stringify(conversationHistory));

        try {
            const response = await fetch(`${API_BASE_URL}/follow-up`, {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                throw new Error(`Follow-up request failed: ${response.statusText}`);
            }
            const data = await response.json();
            setAnalysisResult(data);
            setConversationHistory(prev => [...prev, { type: 'agent', content: data.text }]);
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

            {dataPreview && !analysisResult && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6">Data Preview</Typography>
                        <pre style={{ overflowX: 'auto' }}>{JSON.stringify(dataPreview.head, null, 2)}</pre>
                    </CardContent>
                </Card>
            )}

            {analysisResult && (
                <Card>
                    <CardContent>
                        <Typography variant="h6">Analysis Result</Typography>
                        <Box sx={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', p: 1, mb: 2, borderRadius: '4px' }}>
                            {conversationHistory.map((msg, index) => (
                                <p key={index} style={{ color: msg.type === 'user' ? 'blue' : 'black' }}>
                                    <strong>{msg.type === 'user' ? 'You' : 'Agent'}:</strong> {msg.content}
                                </p>
                            ))}
                        </Box>
                        {analysisResult.plot_path && (
                            <Box my={2}>
                                <img src={`${API_BASE_URL}/${analysisResult.plot_path}`} alt="Analysis Plot" style={{ maxWidth: '100%' }} />
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