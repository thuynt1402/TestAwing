import React, { useState, useCallback, useEffect } from 'react';
import { Container, Typography, Box, Alert } from '@mui/material';
import axios from 'axios';

// Import configuration
import config from './config';

// Import components
import ParameterInput from './components/ParameterInput';
import MatrixInput from './components/MatrixInput';
import History from './components/History';
import VirtualizedSolutionPath from './components/VirtualizedSolutionPath';
import ResultDisplay from './components/ResultDisplay';

// Import types
import {
    TreasureHuntResult,
    TreasureHuntResultWithPath,
    PaginatedResponse,
    PathStep,
    AsyncSolveRequest,
    AsyncSolveResponse,
    SolveStatusResponse,
    SolveStatus
} from './types';

const formatFuelAsMath = (fuelUsed: number): string => {
    // Nếu là số nguyên (phần thập phân = 0) thì không hiển thị phần thập phân
    return Number.isInteger(fuelUsed) ? fuelUsed.toString() : fuelUsed.toFixed(5);
};

const App: React.FC = () => {
    // State for matrix dimensions and values
    const [n, setN] = useState<number>(3);
    const [m, setM] = useState<number>(3);
    const [p, setP] = useState<number>(3);
    // Current dimensions that will be used for rendering
    const [currentN, setCurrentN] = useState<number>(3);
    const [currentM, setCurrentM] = useState<number>(3);
    const [currentP, setCurrentP] = useState<number>(3);
    const [matrix, setMatrix] = useState<string[][]>([]);

    // State for results and path
    const [result, setResult] = useState<number | null>(null);
    const [currentPath, setCurrentPath] = useState<PathStep[]>([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<TreasureHuntResultWithPath | null>(null);

    // UI state
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    // Async solve state
    const [currentSolveId, setCurrentSolveId] = useState<number | null>(null);
    const [solveStatus, setSolveStatus] = useState<SolveStatus>(SolveStatus.Pending);
    const [isPolling, setIsPolling] = useState<boolean>(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);

    // History state
    const [history, setHistory] = useState<TreasureHuntResult[]>([]);
    const [historyPage, setHistoryPage] = useState<number>(1);
    const [itemsPerPage] = useState<number>(8);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [totalCount, setTotalCount] = useState<number>(0);

    // Value change handlers
    const handleNChange = (value: number) => {
        setN(value);
    };

    const handleMChange = (value: number) => {
        setM(value);
    };

    const handlePChange = (value: number) => {
        setP(value);
    };

    // Create matrix with current dimensions (only when button is clicked)
    const createMatrix = () => {
        // Validate dimensions trước khi tạo ma trận
        if (!n || n < 1) {
            setError('Số hàng (n) phải lớn hơn hoặc bằng 1');
            return;
        }
        if (!m || m < 1) {
            setError('Số cột (m) phải lớn hơn hoặc bằng 1');
            return;
        }
        if (!p || p < 1) {
            setError('Giá trị kho báu (p) phải lớn hơn hoặc bằng 1');
            return;
        }
        if (p > n * m) {
            setError(`Giá trị kho báu (p = ${p}) không thể lớn hơn tổng số ô trên ma trận (n × m = ${n * m})`);
            return;
        }

        // Update current dimensions
        setCurrentN(n);
        setCurrentM(m);
        setCurrentP(p);
        
        const newMatrix = Array(n).fill(null).map(() => Array(m).fill(''));
        setMatrix(newMatrix);
        setError('');
        setResult(null);
        setSelectedHistoryItem(null);
    };

    // Matrix change handler
    const handleMatrixChange = (row: number, col: number, value: string) => {
        const newMatrix = [...matrix];
        newMatrix[row][col] = value;
        setMatrix(newMatrix);
    };

    // Example loading handler
    const loadExample = (exampleNumber: number) => {
        switch (exampleNumber) {
            case 1:
                setN(3);
                setM(3);
                setP(3);
                setCurrentN(3);
                setCurrentM(3);
                setCurrentP(3);
                setMatrix([
                    ['3', '2', '2'],
                    ['2', '2', '2'],
                    ['2', '2', '1']
                ]);
                break;
            case 2:
                setN(3);
                setM(4);
                setP(3);
                setCurrentN(3);
                setCurrentM(4);
                setCurrentP(3);
                setMatrix([
                    ['2', '1', '1', '1'],
                    ['1', '1', '1', '1'],
                    ['2', '1', '1', '3']
                ]);
                break;
            case 3:
                setN(3);
                setM(4);
                setP(12);
                setCurrentN(3);
                setCurrentM(4);
                setCurrentP(12);
                setMatrix([
                    ['1', '2', '3', '4'],
                    ['8', '7', '6', '5'],
                    ['9', '10', '11', '12']
                ]);
                break;
        }
    };

    // Random data generation handler
    const generateRandomData = async () => {
        setError('');
        
        // Validate các thông số trước khi gửi request
        if (!n || n < 1) {
            setError('Số hàng (n) phải lớn hơn hoặc bằng 1');
            return;
        }
        if (!m || m < 1) {
            setError('Số cột (m) phải lớn hơn hoặc bằng 1');
            return;
        }
        if (!p || p < 1) {
            setError('Giá trị kho báu (p) phải lớn hơn hoặc bằng 1');
            return;
        }
        if (p > n * m) {
            setError(`Giá trị kho báu (p = ${p}) không thể lớn hơn tổng số ô trên ma trận (n × m = ${n * m})`);
            return;
        }
        
        setLoading(true);
        
        try {
            const response = await axios.get(`${config.apiUrl}/generate-random-data?n=${n}&m=${m}&p=${p}`);
            const { n: newN, m: newM, p: newP, matrix: randomMatrix } = response.data;
            
            setN(newN);
            setM(newM);
            setP(newP);
            setCurrentN(newN);
            setCurrentM(newM);
            setCurrentP(newP);
            setMatrix(randomMatrix.map((row: number[]) => row.map(String)));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to generate random data');
        } finally {
            setLoading(false);
        }
    };

    // File upload/export handlers
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (!e.target?.result) return;
                const content = e.target.result as string;
                const lines = content.split('\n');
                const [newN, newM, newP] = lines[0].trim().split(/\s+/).map(Number);
                
                if (!newN || !newM || !newP || newN <= 0 || newM <= 0 || newP <= 0) {
                    setError('Invalid dimensions in file');
                    return;
                }
                
                if (newP > newN * newM) {
                    setError(`Giá trị kho báu (p = ${newP}) không thể lớn hơn tổng số ô trên ma trận (n × m = ${newN * newM})`);
                    return;
                }
                
                const newMatrix = lines.slice(1, newN + 1).map(line => 
                    line.trim().split(/\s+/)
                );
                
                if (newMatrix.length !== newN || newMatrix.some(row => row.length !== newM)) {
                    setError('Invalid matrix dimensions in file');
                    return;
                }
                
                setN(newN);
                setM(newM);
                setP(newP);
                setCurrentN(newN);
                setCurrentM(newM);
                setCurrentP(newP);
                setMatrix(newMatrix);
                setError('');
            } catch (err) {
                setError('Invalid file format');
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    const handleExportMatrix = () => {
        if (matrix.length === 0) {
            setError('No matrix to export');
            return;
        }

        const content = [
            `${n} ${m} ${p}`,
            ...matrix.map(row => row.join(' '))
        ].join('\n');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `treasure_hunt_matrix_${n}x${m}_p${p}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Matrix validation
    const validateMatrix = (): boolean => {
        if (!matrix || matrix.length === 0) {
            setError('Please create a matrix first');
            return false;
        }

        // Check if matrix exists and has correct dimensions
        if (matrix.length !== currentN || matrix.some(row => row.length !== currentM)) {
            setError('Matrix dimensions do not match current settings. Please create a new matrix.');
            return false;
        }

        // Check if all cells are filled
        for (let i = 0; i < currentN; i++) {
            for (let j = 0; j < currentM; j++) {
                if (!matrix[i][j] || isNaN(Number(matrix[i][j]))) {
                    setError('All matrix cells must be filled with valid numbers');
                    return false;
                }
            }
        }

        // Convert to numbers and validate range
        const numMatrix = matrix.map(row => row.map(cell => Number(cell)));
        const flatMatrix = numMatrix.flat();
        
        if (flatMatrix.some(val => val < 1 || val > currentP)) {
            setError(`All values must be between 1 and ${currentP}`);
            return false;
        }

        if (!flatMatrix.includes(currentP)) {
            setError(`Treasure chest with value ${currentP} must exist in the matrix`);
            return false;
        }
        
        // Kiểm tra p có lớn hơn kích thước ma trận không
        if (currentP > currentN * currentM) {
            setError(`Giá trị kho báu (p = ${currentP}) không thể lớn hơn tổng số ô trên ma trận (n × m = ${currentN * currentM})`);
            return false;
        }

        return true;
    };

    // Load history
    const fetchHistory = useCallback(async (page?: number) => {
        try {
            const currentPage = page || historyPage;
            console.log('Fetching history for page:', currentPage);
            const response = await axios.get<PaginatedResponse<TreasureHuntResult>>(
                `${config.apiUrl}/treasure-hunts?page=${currentPage}&pageSize=${itemsPerPage}`
            );
            console.log('History response:', response.data);
            setHistory(response.data.data);
            setTotalPages(response.data.totalPages);
            setTotalCount(response.data.totalCount);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        }
    }, [historyPage, itemsPerPage]);

    // Auto-fetch history on component mount and when history page changes
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Async solve functions
    const startAsyncSolve = async (): Promise<number> => {
        const numMatrix = matrix.map(row => row.map(cell => Number(cell)));
        const request: AsyncSolveRequest = {
            treasureHuntRequest: {
                n: currentN,
                m: currentM,
                p: currentP,
                matrix: numMatrix
            }
        };

        const response = await axios.post<AsyncSolveResponse>(`${config.apiUrl}/treasure-hunt/solve-async`, request);
        return response.data.solveId;
    };

    const checkSolveStatus = async (solveId: number): Promise<SolveStatusResponse> => {
        const response = await axios.get<SolveStatusResponse>(`${config.apiUrl}/treasure-hunt/solve-status/${solveId}`);
        return response.data;
    };

    const cancelSolve = async (solveId: number): Promise<boolean> => {
        try {
            await axios.post(`${config.apiUrl}/treasure-hunt/cancel-solve/${solveId}`);
            return true;
        } catch (err) {
            console.error('Failed to cancel solve:', err);
            return false;
        }
    };

    const pollSolveStatus = useCallback(async (solveId: number): Promise<void> => {
        setIsPolling(true);
        
        const pollInterval = setInterval(async () => {
            try {
                const status = await checkSolveStatus(solveId);
                setSolveStatus(status.status);

                if (status.status === SolveStatus.Completed) {
                    clearInterval(pollInterval);
                    setIsPolling(false);
                    setLoading(false);
                    setCurrentSolveId(null);
                    
                    if (status.result) {
                        console.log('Solve completed, updating UI and fetching history...');
                        setResult(status.result.minFuel);
                        setCurrentPath(status.result.path || []);
                        setSelectedHistoryItem(null);
                        setHistoryPage(1);
                        // Force fetch history for page 1 to get the latest data
                        await fetchHistory(1);
                        console.log('History fetch completed after solve');
                    }
                } else if (status.status === SolveStatus.Cancelled || status.status === SolveStatus.Failed) {
                    clearInterval(pollInterval);
                    setIsPolling(false);
                    setLoading(false);
                    setCurrentSolveId(null);
                    
                    if (status.status === SolveStatus.Failed) {
                        setError(status.errorMessage || 'Solve operation failed');
                    } else {
                        setError('Solve operation was cancelled');
                    }
                }
            } catch (err) {
                clearInterval(pollInterval);
                setIsPolling(false);
                setLoading(false);
                setCurrentSolveId(null);
                setError('Failed to check solve status');
            }
        }, 1000); // Poll every second

        // Store the interval ID so it can be cleared later
        // This will be cleaned up when the component unmounts or solve completes
    }, [fetchHistory]);

    // Handle cancellation
    const handleCancelSolve = async () => {
        if (currentSolveId) {
            setLoading(false);
            setSolveStatus(SolveStatus.Cancelled);
            await cancelSolve(currentSolveId);
            setCurrentSolveId(null);
            setIsPolling(false);
            
            // Cancel the abort controller if exists
            if (abortController) {
                abortController.abort();
                setAbortController(null);
            }

            // Refresh history to show the cancelled item
            console.log('Solve cancelled, refreshing history...');
            setHistoryPage(1);
            await fetchHistory(1);
            console.log('History refresh completed after cancel');
        }
    };

    // Solve handler with async functionality
    const handleSolve = async () => {
        setError('');
        setResult(null);

        if (!validateMatrix()) {
            return;
        }

        setLoading(true);
        setSolveStatus(SolveStatus.Pending);
        
        // Create abort controller for this solve operation
        const controller = new AbortController();
        setAbortController(controller);

        try {
            // Start the async solve
            const solveId = await startAsyncSolve();
            setCurrentSolveId(solveId);
            setSolveStatus(SolveStatus.InProgress);

            // Start polling for status
            await pollSolveStatus(solveId);
            
        } catch (err: any) {
            setLoading(false);
            setCurrentSolveId(null);
            setAbortController(null);
            setError(err.response?.data?.message || 'An error occurred while solving the treasure hunt');
        }
    };

    return (
        <Container maxWidth={false} sx={{py: 2, px: 2, width: '100%'}}>
            <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
                🏴‍☠️ Treasure Hunt Solver
            </Typography>

            <Box sx={{display: 'flex', gap: 3, flexDirection: {xs: 'column', md: 'row'}}}>
                <Box sx={{flex: '0 0 50%'}}>
                    {/* Parameter Input */}
                    <ParameterInput 
                        n={n}
                        m={m}
                        p={p}
                        loading={loading}
                        solveStatus={solveStatus}
                        onNChange={handleNChange}
                        onMChange={handleMChange}
                        onPChange={handlePChange}
                        onCreateMatrix={createMatrix}
                        onGenerateRandom={generateRandomData}
                        onLoadExample={loadExample}
                        onFileUpload={handleFileUpload}
                        onExportMatrix={handleExportMatrix}
                        onSolve={handleSolve}
                        onCancelSolve={handleCancelSolve}
                    />

                    {/* Error Display */}
                    {error && (
                        <Alert severity="error" sx={{mb: 2}}>
                            {error}
                        </Alert>
                    )}

                    {/* Matrix Input */}
                    {matrix.length > 0 && (
                        <MatrixInput 
                            n={currentN}
                            m={currentM}
                            p={currentP}
                            matrix={matrix}
                            onMatrixChange={handleMatrixChange}
                        />
                    )}

                    {/* Result Display */}
                    <ResultDisplay 
                        result={result}
                        error=""
                        loading={loading}
                        solveStatus={solveStatus}
                        currentSolveId={currentSolveId}
                    />
                </Box>

                {/* History Panel */}
                <Box sx={{flex: 1}}>
                    <History 
                        history={history}
                        totalCount={totalCount}
                        totalPages={totalPages}
                        historyPage={historyPage}
                        onHistoryPageChange={setHistoryPage}
                        onRefresh={() => fetchHistory()}
                        onHistoryItemClick={async (item: TreasureHuntResult) => {
                            try {
                                const response = await axios.get(`${config.apiUrl}/treasure-hunt/${item.id}`);
                                const resultWithPath: TreasureHuntResultWithPath = response.data;
                                
                                setN(resultWithPath.n);
                                setM(resultWithPath.m);
                                setP(resultWithPath.p);
                                setCurrentN(resultWithPath.n);
                                setCurrentM(resultWithPath.m);
                                setCurrentP(resultWithPath.p);
                                setMatrix(resultWithPath.matrix.map(row => row.map(String)));
                                setCurrentPath(resultWithPath.path);
                                setResult(resultWithPath.minFuel);
                                setSelectedHistoryItem(resultWithPath);
                                setError('');
                            } catch (err: any) {
                                setError('Failed to load treasure hunt details');
                            }
                        }}
                    />

                    {/* Solution Path positioned below history */}
                    {(result !== null || selectedHistoryItem) && (
                        <VirtualizedSolutionPath 
                            n={currentN}
                            m={currentM}
                            p={currentP}
                            matrix={matrix}
                            selectedHistoryMatrix={selectedHistoryItem?.matrix}
                            currentPath={currentPath}
                            selectedHistoryPath={selectedHistoryItem?.path}
                            result={result}
                            selectedHistoryItem={selectedHistoryItem}
                            formatFuelAsMath={formatFuelAsMath}
                        />
                    )}
                </Box>
            </Box>
        </Container>
    );
};

export default App;
