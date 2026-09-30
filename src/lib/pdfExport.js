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
    return false;
  }
};
/* ------------------------------------------------------------------ */
/* Recipe-level weekly plan (DietPlanNew / *_newtest endpoints)        */
/* ------------------------------------------------------------------ */

const PLAN_SLOTS = [
  { label: "Breakfast", key: "breakfast" },
  { label: "Lunch", key: "lunch" },
  { label: "Snacks", key: "snacks" },
  { label: "Dinner", key: "dinner" },
];

const HEAD_STYLES = {
  fillColor: [48, 139, 249],
  textColor: [255, 255, 255],
  fontStyle: "bold",
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Same maths as scaledFood() in Dietplannew.jsx: per-serving figures × servings,
// kcal from the API when present, otherwise derived from macros.
const scalePlanFood = (f) => {
  const s = num(f?.servings) || 1;
  const baseKcal =
    f?.kcal_base != null && Number.isFinite(Number(f.kcal_base))
      ? Number(f.kcal_base)
      : num(f?.protein_g) * 4 + num(f?.carbs_g) * 4 + num(f?.fat_g) * 9;
  return {
    kcal: baseKcal * s,
    protein_g: num(f?.protein_g) * s,
    carbs_g: num(f?.carbs_g) * s,
    fat_g: num(f?.fat_g) * s,
    fiber_g: num(f?.fiber_g) * s,
  };
};

const activeFoods = (day, slotKey) =>
  (day?.meals?.[slotKey] || []).filter((f) => f && !f.removed);

const sumDay = (day) => {
  const t = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  PLAN_SLOTS.forEach(({ key }) => {
    activeFoods(day, key).forEach((f) => {
      const s = scalePlanFood(f);
      t.kcal += s.kcal;
      t.protein_g += s.protein_g;
      t.carbs_g += s.carbs_g;
      t.fat_g += s.fat_g;
      t.fiber_g += s.fiber_g;
    });
  });
  return t;
};

const portionLabel = (f) => {
  const s = num(f?.servings) || 1;
  const base = f?.portion ? String(f.portion) : "";
  if (s === 1) return base || "1 serving";
  const servings = `${parseFloat(s.toFixed(2))} servings`;
  return base ? `${base} × ${servings}` : servings;
};

/**
 * Exports the PLAN SHAPE that DietPlanNew renders (see the header comment in
 * components/Dietplannew.jsx): { days: [{ label, date, targets, meals: { slot: [FoodItem] } }] }.
 */
export const exportDietPlanPDF = async (clientName, selectedWeek, plan) => {
  try {
    const pdf = new jsPDF("p", "mm", "a4");
    const days = Array.isArray(plan?.days) ? plan.days : [];

    const cleanClientName = clientName?.trim() || "Client";
    const cleanWeek = selectedWeek?.trim() || "Week";

    let y = 15;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Weekly Diet Plan", 14, y);

    y += 8;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Client Name: ${cleanClientName}`, 14, y);

    y += 6;
    pdf.text(`Selected Week: ${cleanWeek}`, 14, y);

    // Week summary: daily averages plus the week's target (from day 1).
    const dayTotals = days.map(sumDay);
    const n = dayTotals.length || 1;
    const avg = (k) => dayTotals.reduce((a, t) => a + t[k], 0) / n;
    const target = days[0]?.targets || plan?.targets || {};

    y += 10;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Macros Summary (daily average)", 14, y);
    y += 4;

    autoTable(pdf, {
      startY: y,
      head: [["Metric", "Planned", "Target"]],
      body: [
        ["Calories", formatNumber(avg("kcal"), " Kcal"), target.kcal != null ? formatNumber(target.kcal, " Kcal") : "-"],
        ["Carbs", formatNumber(avg("carbs_g"), " g"), target.carbs_g != null ? formatNumber(target.carbs_g, " g") : "-"],
        ["Fat", formatNumber(avg("fat_g"), " g"), target.fat_g != null ? formatNumber(target.fat_g, " g") : "-"],
        ["Protein", formatNumber(avg("protein_g"), " g"), target.protein_g != null ? formatNumber(target.protein_g, " g") : "-"],
        ["Fiber", formatNumber(avg("fiber_g"), " g"), "-"],
      ],
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 3, textColor: [37, 37, 37], overflow: "linebreak" },
      headStyles: HEAD_STYLES,
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 67 }, 2: { cellWidth: 68 } },
    });

    y = pdf.lastAutoTable.finalY + 10;

    days.forEach((day, dayIndex) => {
      if (y > 250) {
        pdf.addPage();
        y = 15;
      }

      const totals = dayTotals[dayIndex];
      const title = safeText(day?.label || `Day ${dayIndex + 1}`);
      const dateSuffix = day?.date ? ` (${day.date})` : "";

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(`${title}${dateSuffix}`, 14, y);

      y += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.text(
        `Total: ${formatNumber(totals.kcal, " kcal")}  |  Carbs ${formatNumber(totals.carbs_g, " g")}  |  Protein ${formatNumber(
          totals.protein_g,
          " g"
        )}  |  Fat ${formatNumber(totals.fat_g, " g")}  |  Fiber ${formatNumber(totals.fiber_g, " g")}`,
        14,
        y
      );
      y += 5;

      PLAN_SLOTS.forEach((slot) => {
        const foods = activeFoods(day, slot.key);

        if (y > 240) {
          pdf.addPage();
          y = 15;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(slot.label, 14, y);
        y += 2;

        if (foods.length === 0) {
          autoTable(pdf, {
            startY: y,
            head: [["Meal", "Status"]],
            body: [[slot.label, "No food data available"]],
            theme: "grid",
            styles: { fontSize: 9, cellPadding: 3, textColor: [37, 37, 37] },
            headStyles: HEAD_STYLES,
            margin: { left: 14, right: 14 },
          });
        } else {
          autoTable(pdf, {
            startY: y,
            head: [["No.", "Food Name", "Calories", "Carbs", "Protein", "Fat", "Fiber", "Portion"]],
            body: foods.map((food, index) => {
              const s = scalePlanFood(food);
              return [
                index + 1,
                safeText(food?.name),
                formatNumber(s.kcal, " kcal"),
                formatNumber(s.carbs_g, " g"),
                formatNumber(s.protein_g, " g"),
                formatNumber(s.fat_g, " g"),
                formatNumber(s.fiber_g, " g"),
                portionLabel(food),
              ];
            }),
            theme: "grid",
            styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [37, 37, 37], overflow: "linebreak", valign: "middle" },
            headStyles: HEAD_STYLES,
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
    pdf.save(`${finalClientName}_diet_plan_${finalWeek}.pdf`);

    return true;
  } catch (error) {
    console.error("PDF export failed:", error);
    return false;
  }
};
