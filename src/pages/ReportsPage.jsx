// pages/ReportsPage.jsx
import { FileText } from "lucide-react";

export default function ReportsPage() {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="text-center">
                <FileText className="mx-auto mb-3 text-secondary" size={40} />
                <p className="text-gray-700 font-semibold">Reports</p>
                <p className="text-gray-400 text-sm mt-1">Coming soon</p>
            </div>
        </div>
    );
}