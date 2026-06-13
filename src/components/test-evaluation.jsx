
"use client"
import Image from "next/image"
import { useSelector } from "react-redux"
import { formatTrackedAt } from "../helpers/dateTime";

export default function TestEvaluation() {
  const scoresInsight = useSelector((state) => state.scoresInsight?.data);
  const formatDate = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(',', '');
  };

  // Helper function to get color class based on zone
  const getZoneColor = (zone) => {
    if (!zone) return 'text-[#535359]'; // Default color for empty values

    const zoneLower = zone.toLowerCase();
    // if (zoneLower === 'good') return 'text-[#3FAF58]';
    // if (zoneLower === 'fair') return 'text-[#FFC412]';
    // if (zoneLower === 'poor') return 'text-[#DA5747]';

     if (zoneLower === 'optimal') return 'text-[#3FAF58]';
    if (zoneLower === 'moderate') return 'text-[#FFBF2D]';
    if (zoneLower === 'focus') return 'text-[#E48326]';

    return 'text-[#535359]'; // Default color for unknown values
  };

  // Get scores from the nested structure
  const scores = scoresInsight?.latest_test?.scores;
  const testDate = scoresInsight?.latest_test?.date_time;
  const metabolismScores = scoresInsight?.latest_test?.test_json?.Metabolism_Score_Analysis;

  const fatLossMetabolism =
    scoresInsight?.latest_test?.test_json?.Fat_Use_Pattern_trend;
 
  // const scientificInterpretation =
  //   scoresInsight?.latest_test?.test_json?.fat_loss_metabolism_score
  //     ?.scientific_interpretation || "";


//         const scientificInterpretation =
//   typeof scoresInsight?.latest_test?.test_json?.Fat_Use_Pattern_trend
//     ?.scientific_interpretation === "string"
//     ? scoresInsight.latest_test.test_json.Fat_Use_Pattern_trend.scientific_interpretation
//     : "";

// console.log("scientificInterpretation57:-", scientificInterpretation);


const sciInterp =
  scoresInsight?.latest_test?.test_json?.Fat_Use_Pattern_trend
    ?.scientific_interpretation;

const sciTitle = typeof sciInterp?.title === "string" ? sciInterp.title : "";
const sciText = typeof sciInterp?.text === "string" ? sciInterp.text : "";


  // let fatImpact = "-";
  // let liverImpact = "-";
  // let gutImpact = "-";

  // // Split using comma
  // const parts = scientificInterpretation.split(",");

  // if (parts.length >= 3) {
  //   fatImpact = parts[0].trim();   // First part
  //   liverImpact = parts[1].trim(); // Second part
  //   gutImpact = parts[2].trim();   // Third part
  // }


  return (
    <>
      <div className="w-full bg-[#F5F7FA] rounded-[15px] p-5">
        <div className="flex flex-col mb-5">
          <span className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">
            Test Evaluation 
          </span>
          {/* <span className="text-[#535359] text-[10px] font-normal tracking-[-0.2px]">
            Tracked At {testDate ? formatDate(testDate) : '-'}
          </span> */}
          <span className="text-[#535359] text-[10px] font-normal tracking-[-0.2px]">
Tracked At {formatTrackedAt(testDate)}

</span>
        </div>

        <div className="border border-[#E1E6ED] mb-3"></div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row gap-[26px] w-full">
            {/* Chart Section */}
            <div className="min-w-0 mt-[3px]">
              <Image
                src="/icons/Frame 427319209.svg"
                alt="Metabolism Chart"
                width={235}
                height={504}
                className="w-full h-[504px] max-w-full object-contain"
              />
            </div>

            {/* Metrics Section */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-5">

  {/* Glucose -Vs- Fat Metabolism */}
                <div className="bg-white rounded-[10px] py-2.5 px-5 w-full">
                  <div className="flex gap-2.5 items-center mb-[5px]">
                     <span className="text-[#252525] text-[12px] font-semibold leading-[110%]">
                      {/* Glucose -Vs- Fat Metabolism */}
                      Fuel & Energy Trend
                    </span>
                    <div className="p-2">
                      <Image
                        src="/icons/healthicons_pancreas-outline.svg"
                        alt="healthicons_pancreas-outline"
                        width={24}
                        height={24}
                         className="opacity-0"
                      />
                    </div>
                   
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
                      <span className="text-[#535359] text-[10px] font-normal block mb-2">
                        {/* Fat Metabolism Score */}
                        Fuel Utilization Trend
                      </span>
                      <div className="flex items-center">
                        <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
                          {/* {scores?.fat ?? '-'}% */}
                          {/* {typeof scores?.fat === "number"
                            ? Math.floor(scores.fat)
                            : "-"
                          }% */}
                          {typeof scores?.fat === "number"
                            ? scores.fat.toFixed(0)
                               : "-"
                            }%

                        </p>
                        <div className="mx-3 h-4 w-px bg-[#252525]"></div>
                        {/* <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.fat_metabolism?.zone)}`}>
                          {metabolismScores?.fat_metabolism?.zone ?? '-'}
                        </p> */}
                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.Fuel_Utilization_Trend?.zone)}`}>
                          {metabolismScores?.Fuel_Utilization_Trend?.zone ?? '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
                      <span className="text-[#535359] text-[10px] font-normal block mb-[5px]">
                        {/* Glucose Metabolism Score */}
                        Energy Source Trend
                      </span>
                      <div className="flex items-center">
                        <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
                          {/* {scores?.glucose ?? '-'}% */}
                          {/* {typeof scores?.glucose === "number"
                            ? Math.floor(scores.glucose)
                            : "-"
                          }% */}
                          {typeof scores?.glucose === "number"
                               ? scores.glucose.toFixed(0)
                                  : "-"
                                  }%

                        </p>
                        <div className="mx-3 h-4 w-px bg-[#252525]"></div>
                        {/* <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.glucose_metabolism?.zone)}`}>
                          {metabolismScores?.glucose_metabolism?.zone ?? '-'}
                        </p> */}
                          <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.Energy_Source_Trend?.zone)}`}>
                          {metabolismScores?.Energy_Source_Trend?.zone ?? '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>





                    {/* Gut Fermentation Metabolism */}
                <div className="bg-white rounded-[10px] py-2.5 px-5 w-full">
                  <div className="flex gap-2.5 items-center mb-[5px]">
                     <span className="text-[#252525] text-[12px] font-semibold leading-[110%]">
                      {/* Gut Fermentation Metabolism */}
                      Digestive Balance Trend
                    </span>
                    <div className="p-2">
                      <Image
                        src="/icons/hugeicons_digestion.svg"
                        alt="hugeicons_digestion"
                        width={24}
                        height={24}
                         className="opacity-0"
                      />
                    </div>
                   
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
                      <span className="text-[#535359] text-[10px] font-normal block mb-[5px]">
                        {/* Absorptive Metabolism Score */}
                        Nutrient Utilization Trend
                      </span>
                      <div className="flex items-center">
                        <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
                          {/* {scores?.absorptive ?? '-'}% */}
                          {/* {typeof scores?.absorptive === "number"
                            ? Math.floor(scores.absorptive)
                            : "-"
                          }% */}

                          {typeof scores?.absorptive === "number"
  ? scores.absorptive.toFixed(0)
  : "-"
}%

                        </p>
                        <div className="mx-3 h-4 w-px bg-[#252525]"></div>
                        {/* <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.absorption?.zone)}`}>
                          {metabolismScores?.absorption?.zone ?? '-'}
                        </p> */}
                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.Nutrient_Utilization_Trend?.zone)}`}>
                          {metabolismScores?.Nutrient_Utilization_Trend?.zone ?? '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
                      <span className="text-[#535359] text-[10px] font-normal block mb-2">
                        {/* Fermentative Metabolism Score */}
                        Digestive Activity Trend
                      </span>
                      <div className="flex items-center">
                        <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
                          {/* {scores?.fermentative ?? '-'}% */}
                          {/* {typeof scores?.fermentative === "number"
                            ? Math.floor(scores.fermentative)
                            : "-"
                          }% */}

                          {typeof scores?.fermentative === "number"
  ? scores.fermentative.toFixed(0)
  : "-"
}%
                        </p>
                        <div className="mx-3 h-4 w-px bg-[#252525]"></div>
                        {/* <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.fermentation?.zone)}`}>
                          {metabolismScores?.fermentation?.zone ?? '-'}
                        </p> */}
                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.Digestive_Activity_Trend?.zone)}`}>
                          {metabolismScores?.Digestive_Activity_Trend?.zone ?? '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              

              

            


                


  {/* Liver Hepatic Metabolism */}
                <div className="bg-white rounded-[10px] py-2.5 px-5 w-full">
                  <div className="flex gap-2.5 items-center mb-[5px]">
                   
                    <span className="text-[#252525] text-[12px] font-semibold leading-[110%]">
                      {/* Liver Hepatic Metabolism */}
                      Metabolic Recovery Trend
                    </span>

                     <div className="p-2">
                      <Image
                        src="/icons/hugeicons_liver.svg"
                        alt="Liver Icon"
                        width={24}
                        height={24}
                         className="opacity-0"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
                      <span className="text-[#535359] text-[10px] font-normal block mb-[5px]">
                        {/* Hepatic Stress Metabolism Score */}
                        Metabolic Load Trend
                      </span>
                      <div className="flex items-center">
                        <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
                          {/* {scores?.hepatic_stress ?? '-'}% */}
                          {/* {typeof scores?.hepatic_stress === "number"
                            ? Math.floor(scores.hepatic_stress)
                            : "-"
                          }% */}
                          {typeof scores?.hepatic_stress === "number"
    ? scores.hepatic_stress.toFixed(0)
    : "-"}
  %
                        </p>
                        <div className="mx-3 h-4 w-px bg-[#252525]"></div>
                        {/* <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.hepatic_stress?.zone)}`}>
                          {metabolismScores?.hepatic_stress?.zone ?? '-'}
                        </p> */}
                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.Metabolic_Load_Trend?.zone)}`}>
                          {metabolismScores?.Metabolic_Load_Trend?.zone ?? '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
                      <span className="text-[#535359] text-[10px] font-normal block mb-2">
                        {/* Detoxification Metabolism Score */}
                        Recovery Activity Trend 
                      </span>
                      <div className="flex items-center">
                        <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
                          {/* {scores?.detoxification ?? '-'}% */}
                          {/* {typeof scores?.detoxification === "number"
                            ? Math.floor(scores.detoxification)
                            : "-"
                          }% */}
                          {typeof scores?.detoxification === "number"
  ? scores.detoxification.toFixed(0)
  : "-"
}%
                        </p>
                        <div className="mx-3 h-4 w-px bg-[#252525]"></div>
                        {/* <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.detoxification?.zone)}`}>
                          {metabolismScores?.detoxification?.zone ?? '-'}
                        </p> */}
                          <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.Recovery_Activity_Trend?.zone)}`}>
                          {metabolismScores?.Recovery_Activity_Trend?.zone ?? '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


            </div>

          </div>

          <div className="flex gap-[75px] pb-[15px] pl-[30px] pt-8 pr-[15px] rounded-[15px] bg-white">
            <div className="flex flex-col">
              <p className="text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap">
                {/* Overall Metabolism Score */}
                Fat Use Pattern Trend
                </p>


              <div className="flex flex-col">
                <div className="flex justify-center items-center">
                  {/* <span className="text-[#252525] font-normal leading-normal tracking-[-2px] text-[100px]">{typeof fatLossMetabolism?.score === "number"
                    ? Math.floor(fatLossMetabolism.score)
                    : 'N/A'}</span> */}

                    <span className="text-[#252525] font-normal leading-normal tracking-[-2px] text-[100px]">
  {typeof fatLossMetabolism?.score === "number"
    ? fatLossMetabolism.score.toFixed(0)   
    : "N/A"}
</span>
                  <span className="flex items-end pb-[10px] text-[#252525] text-[20px] font-semibold leading-[126%] tracking-[-0.4px]">%</span>
                </div>

                <span
                  className={`flex justify-center text-[25px] font-semibold leading-[126%] tracking-[-0.5px] ${getZoneColor(fatLossMetabolism?.zone)}`}
                >
                  {fatLossMetabolism?.zone ?? "-"}
                </span>

              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div className="flex gap-[72px] items-start">
                <div className="text-[#252525] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
                  {/* intervention */}
                  scientific interpretation
                </div>
                {/* <div className="flex gap-3 items-start">
                 
                  <div className="space-y-6">
                    {[
                      "Fat/Glucose Impact",
                      "Liver Impact",
                      "Gut Impact",
                    ].map((item, index) => (
                      <p
                        key={index}
                        className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]"
                      >
                        {item}
                      </p>
                    ))}
                  </div>

                 
                  <div className="space-y-6">
                    {[fatImpact, liverImpact, gutImpact].map((item, index) => (
                      <p
                        key={index}
                        className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]"
                      >
                        {item}
                      </p>
                    ))}
                  </div>

                </div> */}

                <div className="flex flex-col justify-between">
  <div className="flex flex-col gap-3 max-w-[520px]">
    
    <p className="text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.2px]">
      {sciTitle || "-"}
    </p>

    <p className="text-[#535359] text-[10px] font-normal leading-[140%] tracking-[-0.2px]">
      {sciText || "-"}
    </p>

  </div>
</div>


              </div>
              {/* 
<div className="flex items-start gap-3 bg-[#F0F5FD] rounded-[10px] pl-2.5 pt-[15px] pb-[18px] pr-[21px]">
 
  <div className="flex items-center gap-2 shrink-0">
    <Image
      src="/icons/hugeicons_award-01.svg"
      alt="hugeicons_award-01.svg"
      width={15}
      height={15}
    />
    <p className="whitespace-nowrap bg-gradient-to-r from-[#308BF9] to-[#1C5293] bg-clip-text text-transparent text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
      Goal Alignment
    </p>
  </div>


  <p className="flex-1 text-[#252525] text-[10px] font-normal leading-[126%] tracking-[-0.2px]">
    Oats are high in carbohydrates, which can hinder fat loss by maintaining
    glucose reliance. The fiber content, while generally healthy, may
    contribute to the high fermentation observed.
  </p>
</div> */}

            </div>


          </div>
        </div>
      </div>
    </>
  )
}









// "use client"
// import Image from "next/image"
// import { useSelector } from "react-redux"

// export default function TestEvaluation() {
//   const scoresInsight = useSelector((state) => state.scoresInsight?.data);
//   const formatDate = (dateString) => {
//     if (!dateString) return '';

//     const date = new Date(dateString);
//     return date.toLocaleDateString('en-US', {
//       day: '2-digit',
//       month: 'short',
//       year: 'numeric',
//       hour: '2-digit',
//       minute: '2-digit',
//       hour12: true
//     }).replace(',', '');
//   };

//   // Helper function to get color class based on zone
//   const getZoneColor = (zone) => {
//     if (!zone) return 'text-[#535359]'; // Default color for empty values

//     const zoneLower = zone.toLowerCase();
//     if (zoneLower === 'good') return 'text-[#3FAF58]';
//     if (zoneLower === 'fair') return 'text-[#FFC412]';
//     if (zoneLower === 'poor') return 'text-[#DA5747]';

//     return 'text-[#535359]'; // Default color for unknown values
//   };

//   // Get scores from the nested structure
//   const scores = scoresInsight?.latest_test?.scores;
//   const testDate = scoresInsight?.latest_test?.date_time;
//   const metabolismScores = scoresInsight?.latest_test?.test_json?.Metabolism_Score_Analysis;
//   const fatLossMetabolism =
//     scoresInsight?.latest_test?.test_json?.fat_loss_metabolism_score;
//   const scientificInterpretation =
//     scoresInsight?.latest_test?.test_json?.fat_loss_metabolism_score
//       ?.scientific_interpretation || "";

//   let fatImpact = "-";
//   let liverImpact = "-";
//   let gutImpact = "-";

//   // Split using comma
//   const parts = scientificInterpretation.split(",");

//   if (parts.length >= 3) {
//     fatImpact = parts[0].trim();   // First part
//     liverImpact = parts[1].trim(); // Second part
//     gutImpact = parts[2].trim();   // Third part
//   }


//   return (
//     <>
//       <div className="w-full bg-[#F5F7FA] rounded-[15px] p-5">
//         <div className="flex flex-col mb-5">
//           <span className="text-[#252525] text-[20px] font-semibold leading-[110%] tracking-[-0.4px]">
//             Test Evaluation
//           </span>
//           <span className="text-[#535359] text-[10px] font-normal tracking-[-0.2px]">
//             Tracked At {testDate ? formatDate(testDate) : '-'}
//           </span>
//         </div>

//         <div className="border border-[#E1E6ED] mb-3"></div>

//         <div className="flex flex-col gap-5">
//           <div className="flex flex-col lg:flex-row gap-[26px] w-full">
//             {/* Chart Section */}
//             <div className="min-w-0 mt-[3px]">
//               <Image
//                 src="/icons/Frame 427320804.svg"
//                 alt="Metabolism Chart"
//                 width={235}
//                 height={504}
//                 className="w-full h-[504px] max-w-full object-contain"
//               />
//             </div>

//             {/* Metrics Section */}
//             <div className="flex-1 min-w-0">
//               <div className="flex flex-col gap-5">
//                 {/* Liver Hepatic Metabolism */}
//                 <div className="bg-white rounded-[10px] py-2.5 px-5 w-full">
//                   <div className="flex gap-2.5 items-center mb-[5px]">
//                     <div className="p-2">
//                       <Image
//                         src="/icons/hugeicons_liver.svg"
//                         alt="Liver Icon"
//                         width={24}
//                         height={24}
//                       />
//                     </div>
//                     <span className="text-[#252525] text-[12px] font-semibold leading-[110%]">
//                       Liver Hepatic Metabolism
//                     </span>
//                   </div>

//                   <div className="flex flex-col md:flex-row gap-4">
//                     <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
//                       <span className="text-[#535359] text-[10px] font-normal block mb-[5px]">
//                         Hepatic Stress Metabolism Score
//                       </span>
//                       <div className="flex items-center">
//                         <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
//                           {/* {scores?.hepatic_stress ?? '-'}% */}
//                           {typeof scores?.hepatic_stress === "number"
//                             ? Math.floor(scores.hepatic_stress)
//                             : "-"
//                           }%
//                         </p>
//                         <div className="mx-3 h-4 w-px bg-[#252525]"></div>
//                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.hepatic_stress?.zone)}`}>
//                           {metabolismScores?.hepatic_stress?.zone ?? '-'}
//                         </p>
//                       </div>
//                     </div>

//                     <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
//                       <span className="text-[#535359] text-[10px] font-normal block mb-2">
//                         Detoxification Metabolism Score
//                       </span>
//                       <div className="flex items-center">
//                         <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
//                           {/* {scores?.detoxification ?? '-'}% */}
//                           {typeof scores?.detoxification === "number"
//                             ? Math.floor(scores.detoxification)
//                             : "-"
//                           }%
//                         </p>
//                         <div className="mx-3 h-4 w-px bg-[#252525]"></div>
//                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.detoxification?.zone)}`}>
//                           {metabolismScores?.detoxification?.zone ?? '-'}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Glucose -Vs- Fat Metabolism */}
//                 <div className="bg-white rounded-[10px] py-2.5 px-5 w-full">
//                   <div className="flex gap-2.5 items-center mb-[5px]">
//                     <div className="p-2">
//                       <Image
//                         src="/icons/healthicons_pancreas-outline.svg"
//                         alt="healthicons_pancreas-outline"
//                         width={24}
//                         height={24}
//                       />
//                     </div>
//                     <span className="text-[#252525] text-[12px] font-semibold leading-[110%]">
//                       Glucose -Vs- Fat Metabolism
//                     </span>
//                   </div>

//                   <div className="flex flex-col md:flex-row gap-4">
//                     <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
//                       <span className="text-[#535359] text-[10px] font-normal block mb-2">
//                         Fat Metabolism Score
//                       </span>
//                       <div className="flex items-center">
//                         <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
//                           {/* {scores?.fat ?? '-'}% */}
//                           {typeof scores?.fat === "number"
//                             ? Math.floor(scores.fat)
//                             : "-"
//                           }%
//                         </p>
//                         <div className="mx-3 h-4 w-px bg-[#252525]"></div>
//                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.fat_metabolism?.zone)}`}>
//                           {metabolismScores?.fat_metabolism?.zone ?? '-'}
//                         </p>
//                       </div>
//                     </div>

//                     <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
//                       <span className="text-[#535359] text-[10px] font-normal block mb-[5px]">
//                         Glucose Metabolism Score
//                       </span>
//                       <div className="flex items-center">
//                         <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
//                           {/* {scores?.glucose ?? '-'}% */}
//                           {typeof scores?.glucose === "number"
//                             ? Math.floor(scores.glucose)
//                             : "-"
//                           }%
//                         </p>
//                         <div className="mx-3 h-4 w-px bg-[#252525]"></div>
//                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.glucose_metabolism?.zone)}`}>
//                           {metabolismScores?.glucose_metabolism?.zone ?? '-'}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Gut Fermentation Metabolism */}
//                 <div className="bg-white rounded-[10px] py-2.5 px-5 w-full">
//                   <div className="flex gap-2.5 items-center mb-[5px]">
//                     <div className="p-2">
//                       <Image
//                         src="/icons/hugeicons_digestion.svg"
//                         alt="hugeicons_digestion"
//                         width={24}
//                         height={24}
//                       />
//                     </div>
//                     <span className="text-[#252525] text-[12px] font-semibold leading-[110%]">
//                       Gut Fermentation Metabolism
//                     </span>
//                   </div>

//                   <div className="flex flex-col md:flex-row gap-4">
//                     <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
//                       <span className="text-[#535359] text-[10px] font-normal block mb-[5px]">
//                         Absorptive Metabolism Score
//                       </span>
//                       <div className="flex items-center">
//                         <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
//                           {/* {scores?.absorptive ?? '-'}% */}
//                           {typeof scores?.absorptive === "number"
//                             ? Math.floor(scores.absorptive)
//                             : "-"
//                           }%
//                         </p>
//                         <div className="mx-3 h-4 w-px bg-[#252525]"></div>
//                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.absorption?.zone)}`}>
//                           {metabolismScores?.absorption?.zone ?? '-'}
//                         </p>
//                       </div>
//                     </div>

//                     <div className="flex-1 p-4 border border-[#E1E6ED] rounded-[10px]">
//                       <span className="text-[#535359] text-[10px] font-normal block mb-2">
//                         Fermentative Metabolism Score
//                       </span>
//                       <div className="flex items-center">
//                         <p className="text-[#252525] text-[20px] md:text-[25px] font-semibold">
//                           {/* {scores?.fermentative ?? '-'}% */}
//                           {typeof scores?.fermentative === "number"
//                             ? Math.floor(scores.fermentative)
//                             : "-"
//                           }%
//                         </p>
//                         <div className="mx-3 h-4 w-px bg-[#252525]"></div>
//                         <p className={`text-[20px] md:text-[25px] font-semibold ${getZoneColor(metabolismScores?.fermentation?.zone)}`}>
//                           {metabolismScores?.fermentation?.zone ?? '-'}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>


//             </div>

//           </div>

//           <div className="flex gap-[75px] pb-[15px] pl-[30px] pt-8 pr-[15px] rounded-[15px] bg-white">
//             <div className="flex flex-col">
//               <p className="text-[#252525] text-[12px] font-semibold leading-[110%] tracking-[-0.24px] whitespace-nowrap">Overall Metabolism Score</p>


//               <div className="flex flex-col gap-5">
//                 <div className="flex justify-center items-center">
//                   <span className="text-[#252525] font-normal leading-normal tracking-[-2px] text-[100px]">{typeof fatLossMetabolism?.score === "number"
//                     ? Math.floor(fatLossMetabolism.score)
//                     : 'N/A'}</span>
//                   <span className="flex items-end pb-[10px] text-[#252525] text-[20px] font-semibold leading-[126%] tracking-[-0.4px]">%</span>
//                 </div>

//                 <span
//                   className={`flex justify-center text-[25px] font-semibold leading-[126%] tracking-[-0.5px] ${getZoneColor(fatLossMetabolism?.zone)}`}
//                 >
//                   {fatLossMetabolism?.zone ?? "-"}
//                 </span>

//               </div>
//             </div>

//             <div className="flex flex-col justify-between">
//               <div className="flex gap-[72px] items-start">
//                 <div className="text-[#252525] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
//                   intervention
//                 </div>
//                 <div className="flex gap-3 items-start">
//                   {/* Left column */}
//                   <div className="space-y-6">
//                     {[
//                       "Fat/Glucose Impact",
//                       "Liver Impact",
//                       "Gut Impact",
//                     ].map((item, index) => (
//                       <p
//                         key={index}
//                         className="text-[#535359] text-[10px] font-semibold leading-[110%] tracking-[-0.2px]"
//                       >
//                         {item}
//                       </p>
//                     ))}
//                   </div>

//                   {/* Right column */}
//                   <div className="space-y-6">
//                     {[fatImpact, liverImpact, gutImpact].map((item, index) => (
//                       <p
//                         key={index}
//                         className="text-[#535359] text-[10px] font-normal leading-[110%] tracking-[-0.2px]"
//                       >
//                         {item}
//                       </p>
//                     ))}
//                   </div>

//                 </div>

//               </div>
//               {/* 
// <div className="flex items-start gap-3 bg-[#F0F5FD] rounded-[10px] pl-2.5 pt-[15px] pb-[18px] pr-[21px]">
 
//   <div className="flex items-center gap-2 shrink-0">
//     <Image
//       src="/icons/hugeicons_award-01.svg"
//       alt="hugeicons_award-01.svg"
//       width={15}
//       height={15}
//     />
//     <p className="whitespace-nowrap bg-gradient-to-r from-[#308BF9] to-[#1C5293] bg-clip-text text-transparent text-[10px] font-semibold leading-[110%] tracking-[-0.2px]">
//       Goal Alignment
//     </p>
//   </div>


//   <p className="flex-1 text-[#252525] text-[10px] font-normal leading-[126%] tracking-[-0.2px]">
//     Oats are high in carbohydrates, which can hinder fat loss by maintaining
//     glucose reliance. The fiber content, while generally healthy, may
//     contribute to the high fermentation observed.
//   </p>
// </div> */}

//             </div>


//           </div>
//         </div>
//       </div>
//     </>
//   )
// }
