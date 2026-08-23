import React, { useCallback, useEffect, useState } from 'react';
import { fetchProjectTargetComponents } from '../Service';
import type { ProjectTargetComponent } from '../Model.d';
import { CollapsibleTable, ExpandToggleButton } from '../../../components/tailwindui/collapsible-table';
import ComponentTargetsPanel from './ComponentTargetsPanel';

interface ComponentTargetsFormProps {
    /** ProjectPK of the project being viewed (ProjectDetails.ProjectFK). */
    projectPK: string;
}

/**
 * Read-only panel listing every component the project has carried, across every Program
 * Stage it has undergone. Expanding a component reveals that component's targets per stage.
 *
 * Grouping by component rather than by stage is what makes the Source column meaningful:
 * each row inside a component names the stage its figure came from, so the expansion reads
 * as "how did this component's target move across stages".
 */
const ComponentTargetsForm: React.FC<ComponentTargetsFormProps> = ({ projectPK }) => {
    const [components, setComponents] = useState<ProjectTargetComponent[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // Component ids are unique within a project, so the id alone is a sufficient open-panel
    // key. Single-valued: only one component expands at a time.
    const [expandedComponentId, setExpandedComponentId] = useState<string | null>(null);

    useEffect(() => {
        if (!projectPK) return;

        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const response = await fetchProjectTargetComponents(projectPK);
                if (!cancelled) setComponents(response.Data?.Components ?? []);
            } catch {
                // httpClient interceptor already showed the API error toast; degrade to an
                // empty list rather than breaking the rest of the project details page.
                if (!cancelled) setComponents([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [projectPK]);

    const handleToggleComponent = useCallback((component: ProjectTargetComponent) => {
        // Unmounting ComponentTargetsPanel on collapse is what resets its pagination to page 1.
        setExpandedComponentId(prev => (prev === component.ComponentId ? null : component.ComponentId));
    }, []);

    return (
        <div className="overflow-x-auto">
            <CollapsibleTable<ProjectTargetComponent>
                className="mb-0"
                data={components}
                rowKey={(component) => component.ComponentId}
                emptyMessage={isLoading ? 'Loading component targets...' : 'No component targets available for this project'}
                isRowExpanded={(component) => expandedComponentId === component.ComponentId}
                onToggleRow={handleToggleComponent}
                renderExpandedContent={(component) => (
                    <ComponentTargetsPanel projectPK={projectPK} componentId={component.ComponentId} />
                )}
                columns={[
                    {
                        header: 'Component ID',
                        headerClassName: 'text-xs',
                        className: 'font-medium text-sm',
                        render: (component, { isExpanded, toggleExpand }) => (
                            <ExpandToggleButton
                                label={component.ComponentId}
                                isExpanded={isExpanded}
                                onClick={toggleExpand}
                            />
                        )
                    },
                    {
                        header: 'Component Description',
                        headerClassName: 'text-xs',
                        className: 'text-sm text-gray-600',
                        render: (component) => component.ComponentDescription || '—'
                    },
                    {
                        header: 'Stages',
                        headerClassName: 'text-xs',
                        justify: 'center',
                        className: 'text-sm font-medium text-center',
                        render: (component) => component.StageCount
                    }
                ]}
            />
        </div>
    );
};

export default ComponentTargetsForm;
