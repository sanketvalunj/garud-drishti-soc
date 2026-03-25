import React from 'react';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

const RiskChart = ({ riskScores }) => {
    const scores = riskScores || {
        riskAgent: 8,
        compliance: 7,
        businessImpact: 9,
        finalDecision: 8
    };

    const data = {
        labels: ['Risk Agent', 'Compliance', 'Business Impact', 'Final Decision'],
        datasets: [
            {
                label: 'AI Model Scoring',
                data: [scores.riskAgent, scores.compliance, scores.businessImpact, scores.finalDecision],
                backgroundColor: 'rgba(59, 130, 246, 0.2)', // blue-500 with opacity
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                pointBackgroundColor: '#B91C1C', // red standard
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#B91C1C',
                pointRadius: 4,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                pointLabels: {
                    color: '#94a3b8',
                    font: {
                        size: 13,
                        family: "'Inter', sans-serif"
                    }
                },
                ticks: {
                    display: false, // hide the internal numbers
                    min: 0,
                    max: 10,
                    stepSize: 2
                }
            }
        },
        plugins: {
            legend: {
                labels: { color: '#e2e8f0', boxWidth: 12 }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#fff',
                bodyColor: '#cbd5e1',
                borderColor: 'rgba(51, 65, 85, 1)',
                borderWidth: 1
            }
        }
    };

    return (
        <div className="glass-panel p-6 rounded-2xl h-full flex flex-col">
            <h3 className="heading-lg text-white mb-4">AI Risk Visualization</h3>
            <div className="flex-grow w-full h-64 relative flex items-center justify-center">
                <Radar data={data} options={options} />
            </div>
        </div>
    );
};

export default RiskChart;
