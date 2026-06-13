import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function WaterGraph() {
  // Sample data for water consumption
  const data = {
    labels: ['05 Aug', '06 Aug', '07 Aug', '08 Aug', '09 Aug', '10 Aug', '11 Aug' ],
    datasets: [
      {
       
        label: '',
        data: [55, 75, 45, 75, 35, 65, 23],
        borderColor: '#17A1FA',
        backgroundColor: '#17A1FA',
        borderWidth: 1,
        tension: 0, // Changed from 0.4 to 0 for straight lines
        fill: false,
  barThickness: 25,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
        text: 'Weekly Water Intake',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Water: ${context.parsed.y}L`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          callback: function(value) {
            return value;
          }
        },
        title: {
          display: false,
          text: 'Liters'
        },
        grid: {
          display: true,
          
          borderDash: [5, 5], 
          lineWidth: 1,
          drawBorder: false, 
          //color: '#D0D0D0'
        },
        border: {
    display: false,   
  }
      },
      x: {
        title: {
          display: false,
          text: 'Days of Week'
        },
        grid: {
          display: false 
        }
      }
    },
  };

  return (
    <div style={{ width: '100%', height: '300px', margin: '0 auto' }}>
      <Bar data={data} options={options} />
    </div>
  );
}