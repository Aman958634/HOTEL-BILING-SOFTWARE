import { useEffect, useState } from "react";
import { fetchActivityLogs } from "../../services/superAdminService";
import toast from "react-hot-toast";

const ActivityLogsPage = () => {
  const [logs, setLogs] = useState([]);

  const load = async () => {
    try {
      const { data } = await fetchActivityLogs();
      setLogs(data.data.items || []);
    } catch (err) { toast.error("Failed to load activity logs"); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Activity Logs</h2>
      <div className="bg-white rounded shadow p-4">
        {logs.length === 0 ? <p>No activity recorded yet.</p> : (
          <table className="w-full">
            <thead><tr><th>Action</th><th>Description</th><th>Performed By</th><th>Restaurant</th><th>Date</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l._id} className="border-t"><td>{l.message}</td><td>{l.context?.description}</td><td>{l.context?.performedBy}</td><td>{l.context?.restaurantId}</td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ActivityLogsPage;
