

"use client";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function DashboardGraph({ testAnalyticsData }) {
  const processChartData = () => {
    if (!testAnalyticsData?.days || testAnalyticsData.days.length === 0) {
      return {
        labels: [],
        datasets: [],
        dateRange: "No data available",
        rawDays: [],
      };
    }

    const days = testAnalyticsData.days;

    // sort by date
    const sortedDays = [...days].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    // last 7 days
    const last7Days = sortedDays.slice(-7);

    // const labels = last7Days.map((day) => {
    //   const d = new Date(day.date);
    //   return d.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue...
    // });


    const labels = last7Days.map((day) => {
  const d = new Date(day.date);

  const weekday = d.toLocaleDateString("en-US", { weekday: "short" }); // Mon
  const dayNum = d.getDate();                                          // 9
  const month = d.toLocaleDateString("en-US", { month: "short" });     // Dec

  return `${weekday} ${dayNum} ${month}`; // Mon 9 Dec
});



    // ✅ Use percentages so every stacked bar = 100% height
    const testedPercentData = last7Days.map((day) => {
      const tested = day.tested_clients || 0;
      const notTested = day.not_tested_clients || 0;
      const total = tested + notTested;
      if (!total) return 0;
      return (tested / total) * 100;
    });

    const notTestedPercentData = last7Days.map((day) => {
      const tested = day.tested_clients || 0;
      const notTested = day.not_tested_clients || 0;
      const total = tested + notTested;
      if (!total) return 0;
      return (notTested / total) * 100;
    });

    // 🔴 Check for empty data (no tested and no not_tested clients)
    const emptyDataBars = last7Days.map((day) => {
      const tested = day.tested_clients || 0;
      const notTested = day.not_tested_clients || 0;
      const total = tested + notTested;
      // Return 100% for empty dates, 0 for dates with data
      return !total ? 100 : 0;
    });

    // 🔹 GAP height between Tested and Not Tested (in percentage units)
    const GAP_VALUE = 4;

    // 🔹 Reduce "Not Tested" so Tested + Spacer + NotTested still ≈ 100
    const adjustedNotTested = notTestedPercentData.map((v) =>
      Math.max(v - GAP_VALUE, 0)
    );

    const dateRange = getDateRange(last7Days);

    return {
      labels,
      datasets: [
        // 🔴 Empty Data (red bar for dates with no data) – shown first so it's behind other bars
        {
          label: "No Data",
          data: emptyDataBars,
          backgroundColor: "#F5F7FA", // Red color
          stack: "clients",
          borderSkipped: false,
          borderRadius: (ctx) => ({
            topLeft: 10,
            topRight: 10,
            bottomLeft: 10,
            bottomRight: 10,
          }),
        },
        // 🔵 Tested (top) – rounded top corners
        {
          label: "Tested Clients",
          data: testedPercentData,
          backgroundColor: "#0B3971",
          stack: "clients",
          borderSkipped: false,
          borderRadius: (ctx) => ({
            topLeft: 10,
            topRight: 10,
            bottomLeft: 10,
            bottomRight: 10,
          }),
        },

        // 🧊 Spacer in between (fake gap, transparent)
        {
          label: "Spacer",
          data: last7Days.map((day) => {
            const tested = day.tested_clients || 0;
            const notTested = day.not_tested_clients || 0;
            const total = tested + notTested;
            // No spacer for empty dates
            return !total ? 0 : GAP_VALUE;
          }),
          backgroundColor: "rgba(0,0,0,0)",
          stack: "clients",
          borderSkipped: false,
        },

        // ⚪ Not Tested (bottom) – rounded bottom corners
        {
          label: "Not Tested Clients",
          data: adjustedNotTested,
          backgroundColor: "#F5F7FA",
          stack: "clients",
          borderSkipped: false,
          borderRadius: (ctx) => ({
            topLeft: 10,
            topRight: 10,
            bottomLeft: 10,
            bottomRight: 10,
          }),
        },
      ],
      dateRange,
      rawDays: last7Days, // keep raw counts for tooltip
    };
  };

  const getDateRange = (days) => {
    if (!days || days.length === 0) return "No data available";

    const firstDate = new Date(days[0].date);
    const lastDate = new Date(days[days.length - 1].date);

    const formatDate = (date) => {
      const day = date.getDate();
      const month = date.toLocaleDateString("en-US", { month: "long" });
      return `${day} ${month}`;
    };

    return `${formatDate(firstDate)} - ${formatDate(lastDate)}`;
  };

  const { labels, datasets, dateRange, rawDays } = processChartData();

  const chartData = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      // if you had softShadow globally, disable here
      softShadow: false,
      legend: {
        display: true,
        position: "top",
        labels: {
          color: "#252525",
          usePointStyle: true,
          pointStyle: "rect",
          padding: 20,
          font: {
            size: 12,
          },
          // ❌ Hide "Spacer" and "No Data" from legend
          filter: (item) => item.text !== "Spacer" && item.text !== "No Data",
        },
      },
    tooltip: {
  backgroundColor: "#252525",
  titleColor: "#fff",
  bodyColor: "#fff",
  callbacks: {
    title: (context) => {
      const index = context[0].dataIndex;
      const dayObj = rawDays?.[index];

      if (dayObj?.date) {
        const fullDate = new Date(dayObj.date);
        return fullDate.toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }

      return context[0].label;
    },

    label: (context) => {
      const index = context.dataIndex;
      const datasetLabel = context.dataset.label || "";

      // hide tooltip for spacer
      if (datasetLabel === "Spacer") return "";

      const dayObj = rawDays?.[index];
      const tested = dayObj?.tested_clients || 0;
      const notTested = dayObj?.not_tested_clients || 0;

      // Show "No data" for empty dates
      if (datasetLabel === "No Data") {
        return "No data available";
      }

      if (datasetLabel === "Tested Clients") {
        return `Tested Clients: ${tested}`;
      }

      if (datasetLabel === "Not Tested Clients") {
        return `Not Tested Clients: ${notTested}`;
      }

      return "";
    },
  },
},

    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: "#535359",
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        max: 100, // ✅ always 0–100
        grid: {
          display: false,
        },
        ticks: {
          display: false,
        },
        border: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="px-6 flex flex-col items-center overflow-x-auto">
      <div className="flex items-center justify-center w-[1000px] h-[300px]">
        {chartData.labels.length > 0 ? (
          <Bar data={chartData} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full text-[#A1A1A1]">
            No test data available for the selected period
          </div>
        )}
      </div>

      <div className="w-full flex justify-center border-t border-[#E1E6ED] mt-[13px] pt-[13px]">
        <span className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]">
          {dateRange}
        </span>
      </div>
    </div>
  );
}