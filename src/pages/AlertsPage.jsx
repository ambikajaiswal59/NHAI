// pages/AlertsPage.jsx
import { Bell } from "lucide-react";

export default function AlertsPage() {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="text-center">
                <Bell className="mx-auto mb-3 text-secondary" size={40} />
                <p className="text-gray-700 font-semibold">Alerts</p>
                <p className="text-gray-400 text-sm mt-1">Coming soon</p>
            </div>
        </div>
    );
}