// pages/AnalyticsPage.jsx
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="text-center">
                <BarChart3 className="mx-auto mb-3 text-secondary" size={40} />
                <p className="text-gray-700 font-semibold">Analytics</p>
                <p className="text-gray-400 text-sm mt-1">Coming soon</p>
            </div>
        </div>
    );
}