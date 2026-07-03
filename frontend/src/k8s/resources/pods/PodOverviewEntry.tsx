import { createRoot } from 'react-dom/client';
import '../../../app.css';
import '../../../style.css';
import { GenericResourceTable } from '../../../components/GenericResourceTable';
import { podConfig } from '../../../config/resourceConfigs/podConfig';

type RenderPodOverviewTableArgs = {
	container: Element | null;
	namespace?: string;
	namespaces?: string[];
	onCreateResource?: (_type?: string) => void;
};
const rootByContainer = new WeakMap<Element, ReturnType<typeof createRoot>>();

export function renderPodOverviewTable({ container, namespace, namespaces, onCreateResource }: RenderPodOverviewTableArgs) {
	if (!container) return null;
	let root = rootByContainer.get(container);
	if (!root) {
		root = createRoot(container);
		rootByContainer.set(container, root);
	}
	root.render(<GenericResourceTable {...podConfig} namespace={namespace} namespaces={namespaces} />);
	return root;
}