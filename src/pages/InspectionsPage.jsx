// pages/InspectionsPage.jsx
import { ClipboardCheck } from "lucide-react";

export default function InspectionsPage() {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="text-center">
                <ClipboardCheck className="mx-auto mb-3 text-secondary" size={40} />
                <p className="text-gray-700 font-semibold">Inspections  </p>
                <p className="text-gray-400 text-sm mt-1">Coming soon</p>
            </div>
        </div>
    );
}