import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formatNumber = (value, suffix = "") => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return `0${suffix}`;
  return `${parseFloat(num.toFixed(2))}${suffix}`;
};

const safeText = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const getPortionText = (portion) => {
  if (!portion) return "-";
  return String(portion);
};

export const exportDietAnalysisPDF = async (
  clientName,
  selectedWeek,
  dietAnalysisData
) => {
  try {
    const pdf = new jsPDF("p", "mm", "a4");

    const weeklyFoodJson = dietAnalysisData?.data?.food_json || {};
    const weeklyData = weeklyFoodJson?.weekly_json_data || {};
    const days = weeklyFoodJson?.days || [];

    const cleanClientName = clientName?.trim() || "Client";
    const cleanWeek = selectedWeek?.trim() || "Week";

    let y = 15;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Diet Analysis Report", 14, y);

    y += 8;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Client Name: ${cleanClientName}`, 14, y);

    y += 6;
    pdf.text(`Selected Week: ${cleanWeek}`, 14, y);

    y += 10;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Macros Summary", 14, y);

    y += 4;

    autoTable(pdf, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Calories", formatNumber(weeklyData?.calories, " Kcal")],
        ["Carbs", formatNumber(weeklyData?.carbs_g, " g")],
        ["Fat", formatNumber(weeklyData?.fat_g, " g")],
        ["Protein", formatNumber(weeklyData?.protein_g, " g")],
        ["Fiber", formatNumber(weeklyData?.fiber_g, " g")],
        ["Note", safeText(weeklyData?.note)],
      ],
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 3,
        textColor: [37, 37, 37],
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [48, 139, 249],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 135 },
      },
    });

    y = pdf.lastAutoTable.finalY + 10;

    const meals = [
      { label: "Breakfast", key: "breakfast" },
      { label: "Lunch", key: "lunch" },
      { label: "Snacks", key: "snacks" },
      { label: "Dinner", key: "dinner" },
    ];

    days.forEach((dayItem, dayIndex) => {
      if (y > 250) {
        pdf.addPage();
        y = 15;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(`Day ${dayIndex + 1} - ${safeText(dayItem?.day)}`, 14, y);

      y += 5;

      meals.forEach((meal) => {
        const foods = dayItem?.[meal.key]?.foods || [];

        if (y > 240) {
          pdf.addPage();
          y = 15;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(meal.label, 14, y);

        y += 2;

        if (foods.length === 0) {
          autoTable(pdf, {
            startY: y,
            head: [["Meal", "Status"]],
            body: [[meal.label, "No food data available"]],
            theme: "grid",
            styles: {
              fontSize: 9,
              cellPadding: 3,
              textColor: [37, 37, 37],
            },
            headStyles: {
              fillColor: [48, 139, 249],
              textColor: [255, 255, 255],
            },
            margin: { left: 14, right: 14 },
          });
        } else {
          autoTable(pdf, {
            startY: y,
            head: [[
              "No.",
              "Food Name",
              "Calories",
              "Carbs",
              "Protein",
              "Fat",
              "Fiber",
              "Portion"
            ]],
            body: foods.map((food, index) => [
              index + 1,
              safeText(food?.food_name),
              formatNumber(food?.calories, " kcal"),
              formatNumber(food?.carbs_g, " g"),
              formatNumber(food?.protein_g, " g"),
              formatNumber(food?.fat_g, " g"),
              formatNumber(food?.fiber_g, " g"),
              getPortionText(food?.portion_with_metric),
            ]),
            theme: "grid",
            styles: {
              fontSize: 8.5,
              cellPadding: 2.5,
              textColor: [37, 37, 37],
              overflow: "linebreak",
              valign: "middle",
            },
            headStyles: {
              fillColor: [48, 139, 249],
              textColor: [255, 255, 255],
              fontStyle: "bold",
            },
            margin: { left: 14, right: 14 },
            columnStyles: {
              0: { cellWidth: 10 },
              1: { cellWidth: 42 },
              2: { cellWidth: 22 },
              3: { cellWidth: 18 },
              4: { cellWidth: 20 },
              5: { cellWidth: 16 },
              6: { cellWidth: 16 },
              7: { cellWidth: 34 },
            },
          });
        }

        y = pdf.lastAutoTable.finalY + 8;
      });

      y += 2;
    });

    const finalClientName = cleanClientName.replace(/\s+/g, "_");
    const finalWeek = cleanWeek.replace(/\s+/g, "_");
    pdf.save(`${finalClientName}_diet_analysis_${finalWeek}.pdf`);

    return true;
  } catch (error) {
    console.error("PDF export failed:", error);
    alert("Failed to export PDF. Please try again.");
    return false;
  }
};