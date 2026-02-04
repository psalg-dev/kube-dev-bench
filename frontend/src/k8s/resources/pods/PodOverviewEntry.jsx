import { createRoot } from 'react-dom/client';
import PodOverviewTable from './PodOverviewTable';
import '../../../style.css';
import '../../../app.css';

const rootByContainer = new WeakMap();

export function renderPodOverviewTable({ container, namespace, namespaces, onCreateResource }) {
  if (!container) return null;
  let root = rootByContainer.get(container);
  if (!root) {
    root = createRoot(container);
    rootByContainer.set(container, root);
  }
  root.render(<PodOverviewTable namespace={namespace} namespaces={namespaces} onCreateResource={onCreateResource} />);
  return root;
}
