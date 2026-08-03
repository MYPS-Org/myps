import React, { useMemo, useState } from 'react';
import MapRenderer from '../../components/map/MapRenderer';
import { Heading } from '../../components/tailwindui/heading';
import { Button } from '../../components/tailwindui/button';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/tailwindui/table';
import { bridgeSample } from './mockData/bridgeSample';
import { roadSample } from './mockData/roadSample';
import { adaptSampleFeature } from './adaptSampleFeature';
import { PLAYGROUND_MAP_LAYERS } from './playgroundLayerConfig';

interface EditableFields {
  ProgramName: string;
  ScopeOfWork: string;
  PhysicalTarget: number;
  TargetUnit: string;
  StartStationLimit: string;
  EndStationLimit: string;
}

function buildInitialFeatures(): GeoJSON.Feature[] {
  return [...bridgeSample.features, ...roadSample.features].map(adaptSampleFeature);
}

function jitter(coord: number[]): number[] {
  return [coord[0] + (Math.random() - 0.5) * 0.01, coord[1] + (Math.random() - 0.5) * 0.01];
}

let nextSampleId = 900000;

const GisPlaygroundPage: React.FC = () => {
  const [features, setFeatures] = useState<GeoJSON.Feature[]>(buildInitialFeatures);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditableFields | null>(null);

  const geoJsonData = useMemo<GeoJSON.FeatureCollection>(
    () => ({ type: 'FeatureCollection', features }),
    [features]
  );

  const addFeature = (infraType: 'Bridges' | 'Roads') => {
    const template = features.find((f) => f.properties?.InfraType === infraType);
    if (!template) return;

    const geometry: GeoJSON.Geometry =
      template.geometry.type === 'Point'
        ? { type: 'Point', coordinates: jitter(template.geometry.coordinates) }
        : { type: 'LineString', coordinates: (template.geometry as GeoJSON.LineString).coordinates.map(jitter) };

    const id = nextSampleId++;
    const newFeature = adaptSampleFeature({
      type: 'Feature',
      properties: {
        ...template.properties,
        Id: id,
        ProgramName: `New ${infraType === 'Bridges' ? 'Bridge' : 'Road'}`,
        DetailedScope: '',
      },
      geometry,
    });

    setFeatures((prev) => [...prev, newFeature]);
  };

  const deleteFeature = (id: number) => {
    setFeatures((prev) => prev.filter((f) => f.properties?.Id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraft(null);
    }
  };

  const startEdit = (feature: GeoJSON.Feature) => {
    const props = feature.properties ?? {};
    setEditingId(props.Id as number);
    setDraft({
      ProgramName: props.ProgramName ?? '',
      ScopeOfWork: props.ScopeOfWork ?? '',
      PhysicalTarget: props.PhysicalTarget ?? 0,
      TargetUnit: props.TargetUnit ?? '',
      StartStationLimit: props.StartStationLimit ?? '',
      EndStationLimit: props.EndStationLimit ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (editingId === null || !draft) return;
    setFeatures((prev) =>
      prev.map((f) =>
        f.properties?.Id === editingId
          ? adaptSampleFeature({ ...f, properties: { ...f.properties, ...draft } })
          : f
      )
    );
    cancelEdit();
  };

  const resetSampleData = () => {
    setFeatures(buildInitialFeatures());
    cancelEdit();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Heading>GIS Sample Data Playground</Heading>
        <div className="flex gap-2">
          <Button outline onClick={() => addFeature('Bridges')}>
            Add Bridge
          </Button>
          <Button outline onClick={() => addFeature('Roads')}>
            Add Road
          </Button>
          <Button plain onClick={resetSampleData}>
            Reset sample data
          </Button>
        </div>
      </div>

      <MapRenderer geoJsonData={geoJsonData} layers={PLAYGROUND_MAP_LAYERS} height="500px" />

      <Table dense striped>
        <TableHead>
          <TableRow>
            <TableHeader>Type</TableHeader>
            <TableHeader>Program</TableHeader>
            <TableHeader>Scope of Work</TableHeader>
            <TableHeader>Target</TableHeader>
            <TableHeader>Station Limits</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {features.map((feature) => {
            const props = feature.properties ?? {};
            const id = props.Id as number;
            const isEditing = editingId === id;

            if (isEditing && draft) {
              return (
                <TableRow key={id}>
                  <TableCell>{props.InfraType}</TableCell>
                  <TableCell>
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={draft.ProgramName}
                      onChange={(e) => setDraft({ ...draft, ProgramName: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={draft.ScopeOfWork}
                      onChange={(e) => setDraft({ ...draft, ScopeOfWork: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        className="border rounded px-2 py-1 w-20"
                        value={draft.PhysicalTarget}
                        onChange={(e) => setDraft({ ...draft, PhysicalTarget: Number(e.target.value) })}
                      />
                      <input
                        className="border rounded px-2 py-1 w-24"
                        value={draft.TargetUnit}
                        onChange={(e) => setDraft({ ...draft, TargetUnit: e.target.value })}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <input
                        className="border rounded px-2 py-1 w-24"
                        value={draft.StartStationLimit}
                        onChange={(e) => setDraft({ ...draft, StartStationLimit: e.target.value })}
                      />
                      <input
                        className="border rounded px-2 py-1 w-24"
                        value={draft.EndStationLimit}
                        onChange={(e) => setDraft({ ...draft, EndStationLimit: e.target.value })}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button onClick={saveEdit}>Save</Button>
                      <Button plain onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }

            return (
              <TableRow key={id}>
                <TableCell>{props.InfraType}</TableCell>
                <TableCell>{props.ProgramName}</TableCell>
                <TableCell>{props.ScopeOfWork}</TableCell>
                <TableCell>
                  {props.PhysicalTarget} {props.TargetUnit}
                </TableCell>
                <TableCell>
                  {(props.StartStationLimit ?? '').trim() || (props.EndStationLimit ?? '').trim()
                    ? `${props.StartStationLimit} - ${props.EndStationLimit}`
                    : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button plain onClick={() => startEdit(feature)}>
                      Edit
                    </Button>
                    <Button plain onClick={() => deleteFeature(id)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default GisPlaygroundPage;
