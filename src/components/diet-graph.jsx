

"use client"
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

// register components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function DietGraph() {
  const data = {
    labels: ["Protein"],
    datasets: [
     {
    label: "Followed",
    data: [80],
    backgroundColor: "#E48326",
    borderRadius: 5,
    stack: "total",
  },
  {
    // 5px gap created using a fixed transparent bar
    label: "Gap",
    data: [5], // this is the gap size
    backgroundColor: "rgba(0,0,0,0)", // transparent
    stack: "total",
    borderSkipped: false,
  },
  {
    label: "Not Followed",
    data: [40],
    backgroundColor: "#FDCB6E",
    borderRadius: 5,
    stack: "total",
  },
    ],
  };

  const options = {
    indexAxis: "y", 
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "#252525",
        titleColor: "#fff",
        bodyColor: "#fff",
      },
    },
   scales: {
  x: {
    stacked: true,
    beginAtZero: true,
    grid: { display: false },
    ticks: { display: false },
    border: { display: false },
  },
  y: {
    stacked: true,
    grid: { display: false },
    ticks: { display: false },
    border: { display: false },
  },
},
  };

  return (
   
      <div className="">
        <Bar data={data} options={options} />
      </div>
   
  );
}
