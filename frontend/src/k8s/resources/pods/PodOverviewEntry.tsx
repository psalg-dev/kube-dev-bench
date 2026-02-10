import { createRoot } from 'react-dom/client';
import PodOverviewTable from './PodOverviewTable';
import '../../../style.css';
import '../../../app.css';

type RenderPodOverviewTableArgs = {
	container: Element | null;
	namespace?: string;
	namespaces?: string[];
	onCreateResource?: (type?: string) => void;
};

const rootByContainer = new WeakMap<Element, ReturnType<typeof createRoot>>();

export function renderPodOverviewTable({ container, namespace, namespaces, onCreateResource }: RenderPodOverviewTableArgs) {
	if (!container) return null;
	let root = rootByContainer.get(container);
	if (!root) {
		root = createRoot(container);
		rootByContainer.set(container, root);
	}
	root.render(<PodOverviewTable namespace={namespace} namespaces={namespaces} onCreateResource={onCreateResource} />);
	return root;
}