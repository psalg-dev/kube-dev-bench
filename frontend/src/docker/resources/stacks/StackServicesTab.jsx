import { useEffect, useState } from 'react';
import { GetSwarmStackServices } from '../../swarmApi.js';
import { formatAge } from '../../../utils/timeUtils.js';
import './StackServicesTab.css';

export default function StackServicesTab({ stackName }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      try {
        const result = await GetSwarmStackServices(stackName);
        if (active) {
          setServices(result || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load stack services:', err);
        if (active) {
          setError(err.toString());
          setLoading(false);
        }
      }
    };

    loadServices();
    const interval = setInterval(loadServices, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [stackName]);

  if (loading) {
    return (
      <div className="stack-services-loading">Loading services...</div>
    );
  }

  if (error) {
    return (
      <div className="stack-services-error">Failed to load services: {error}</div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="stack-services-empty">No services in this stack</div>
    );
  }

  return (
    <div className="stack-services-container">
      <table className="stack-services-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Image</th>
            <th>Mode</th>
            <th>Replicas</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {services.map(svc => (
            <tr key={svc.id}>
              <td>{svc.name}</td>
              <td className="mono">{svc.image}</td>
              <td>{svc.mode}</td>
              <td>
                <span className={svc.runningTasks === svc.replicas ? 'replica-ok' : 'replica-warn'}>
                  {svc.runningTasks}/{svc.replicas}
                </span>
              </td>
              <td>{formatAge(svc.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
