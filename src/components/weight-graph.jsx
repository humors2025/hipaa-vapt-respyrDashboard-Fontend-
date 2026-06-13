import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function WeightGraph({ weightData = [], labels = [] }) {
  // Default data if no props provided
  const defaultData = {
    labels: ['05 Aug', '06 Aug', '07 Aug', '08 Aug', '09 Aug', '10 Aug'],
    datasets: [
      {
        label: '',
        data: [55, 75, 45, 75, 35, 65],
        borderColor: '#B388EB',
        backgroundColor: '',
        borderWidth: 2,
        tension: 0, 
        fill: false,
      },
    ],
  };

  // Use provided data or default data
  const chartData = weightData.length > 0 ? {
    labels: labels.length > 0 ? labels : defaultData.labels,
    datasets: [
      {
        ...defaultData.datasets[0],
        data: weightData,
      },
    ],
  } : defaultData;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, 
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20, // Force ticks every 20 units
          callback: function(value) {
            // This ensures only your desired values are shown
            return [0, 20, 40, 60, 80, 100].includes(value) ? value : '';
          }
        },
        title: {
          display: false,
          text: 'Weight (kg)'
        },
        grid: {
          display: false,
        },
        border: {
          display: false, 
        },
      },
      x: {
        title: {
          display: false,
          text: 'Time'
        },
         ticks: {
    padding: 20, 
  },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.2)',
          drawBorder: false,
          drawTicks: false,
          borderDash: [3, 3],
          borderDashOffset: 1, 
          
        },
        border: {
          display: false, // <-- REMOVE Y-AXIS LINE
        },
         
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
  };

  return (
    <div style={{ width: '100%', height: '300px', maxWidth: '600px', margin: '0 auto' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}