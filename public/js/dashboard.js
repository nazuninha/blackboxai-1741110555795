function dashboard() {
    return {
        stats: window.dashboardData.stats,
        numbers: window.dashboardData.numbers,
        activity: window.dashboardData.activity,
        charts: {},

        async init() {
            // Initialize charts
            this.initCharts();
            
            // Set up real-time updates
            this.setupUpdates();
            
            // Load initial data
            await this.loadData();
        },

        async loadData() {
            try {
                // Load metrics
                const [messageVolume, responseTime] = await Promise.all([
                    fetch('/api/metrics/message-volume').then(r => r.json()),
                    fetch('/api/metrics/response-time').then(r => r.json())
                ]);

                // Update charts
                this.updateCharts(messageVolume, responseTime);
            } catch (error) {
                console.error('Error loading data:', error);
                this.$dispatch('notify', {
                    type: 'error',
                    message: 'Error loading dashboard data'
                });
            }
        },

        initCharts() {
            // Message Volume Chart
            this.charts.messageVolume = new ApexCharts(this.$refs.messageVolumeChart, {
                chart: {
                    type: 'area',
                    height: 256,
                    toolbar: { show: false },
                    animations: { enabled: true }
                },
                series: [{ name: 'Messages', data: [] }],
                xaxis: {
                    categories: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                    labels: { show: true }
                },
                yaxis: { labels: { show: true } },
                stroke: { curve: 'smooth', width: 3 },
                fill: {
                    type: 'gradient',
                    gradient: {
                        shadeIntensity: 1,
                        opacityFrom: 0.7,
                        opacityTo: 0.3
                    }
                },
                theme: { mode: localStorage.getItem('darkMode') === 'true' ? 'dark' : 'light' }
            });
            this.charts.messageVolume.render();

            // Response Time Chart
            this.charts.responseTime = new ApexCharts(this.$refs.responseTimeChart, {
                chart: {
                    type: 'line',
                    height: 256,
                    toolbar: { show: false },
                    animations: { enabled: true }
                },
                series: [{ name: 'Response Time', data: [] }],
                xaxis: {
                    type: 'datetime',
                    labels: { show: true }
                },
                yaxis: {
                    labels: { show: true },
                    title: { text: 'Response Time (ms)' }
                },
                stroke: { curve: 'smooth', width: 3 },
                theme: { mode: localStorage.getItem('darkMode') === 'true' ? 'dark' : 'light' }
            });
            this.charts.responseTime.render();

            // Update chart theme when dark mode changes
            this.$watch('darkMode', (darkMode) => {
                Object.values(this.charts).forEach(chart => {
                    chart.updateOptions({
                        theme: { mode: darkMode ? 'dark' : 'light' }
                    });
                });
            });
        },

        updateCharts(messageVolume, responseTime) {
            // Update message volume chart
            this.charts.messageVolume.updateSeries([{
                name: 'Messages',
                data: messageVolume.hourly
            }]);

            // Update response time chart
            this.charts.responseTime.updateSeries([{
                name: 'Response Time',
                data: responseTime.data
            }]);
        },

        setupUpdates() {
            const events = new EventSource('/api/updates');

            events.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleUpdate(data);
            };

            events.onerror = () => {
                console.error('SSE connection error');
                events.close();
                setTimeout(() => this.setupUpdates(), 5000);
            };

            // Clean up on page unload
            window.addEventListener('beforeunload', () => {
                events.close();
            });
        },

        handleUpdate(data) {
            switch (data.type) {
                case 'stats':
                    this.stats = { ...this.stats, ...data.data };
                    break;
                case 'numbers':
                    this.numbers = data.data;
                    break;
                case 'activity':
                    this.activity.unshift(data.data);
                    this.activity = this.activity.slice(0, 10);
                    break;
                case 'metrics':
                    this.updateCharts(data.data.messageVolume, data.data.responseTime);
                    break;
                case 'connection':
                    this.handleConnectionUpdate(data.data);
                    break;
            }
        },

        handleConnectionUpdate(data) {
            const index = this.numbers.findIndex(n => n.id === data.numberId);
            if (index !== -1) {
                this.numbers[index] = {
                    ...this.numbers[index],
                    isConnected: data.status === 'connected'
                };
            }
        },

        formatDate(date) {
            if (!date) return '';
            return new Date(date).toLocaleString();
        },

        viewDetails(number) {
            window.location.href = `/numbers/${number.id}`;
        }
    };
}
