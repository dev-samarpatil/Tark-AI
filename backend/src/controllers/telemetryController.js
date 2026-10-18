export const syncTelemetry = (req, res) => {
  const { latency = 64, activeView = 'workspace', events = [] } = req.body;
  
  res.json({
    success: true,
    syncStatus: 'synced',
    timestamp: Date.now(),
    serverLatency: `${Math.floor(Math.random() * 20) + 45}ms`
  });
};
