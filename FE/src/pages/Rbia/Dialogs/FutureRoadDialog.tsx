import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { roadsAtom, selectedItemAtom, type Road } from "../state/rbiaAtoms";

const FutureRoadDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [roads, setRoads] = useAtom(roadsAtom);
  const [selectedItem] = useAtom(selectedItemAtom);
  const [formData, setFormData] = useState<Road>({
    roadId: "",
    name: "",
    classification: 0,
  });

  useEffect(() => {
    if (selectedItem && 'roadId' in selectedItem && 'classification' in selectedItem) {
      setFormData(selectedItem as Road); // Populate form with selected item for editing
    }
  }, [selectedItem]);

  const handleSubmit = () => {
    if (!formData.roadId.startsWith("FR")) {
      alert("Road ID must start with 'FR'");
      return;
    }
    if (selectedItem) {
      // Edit existing road
      setRoads(
        roads.map((road: Road) =>
          road.roadId === (selectedItem as Road).roadId ? formData : road
        )
      );
    } else {
      // Create new road
      setRoads([...roads, formData]);
    }
    onClose();
  };

  return (
    <div className="dialog">
      <h2>{selectedItem ? "Edit Future Road" : "Create Future Road"}</h2>
      <input
        type="text"
        placeholder="Road ID"
        value={formData.roadId}
        onChange={(e) => setFormData({ ...formData, roadId: e.target.value })}
      />
      <input
        type="text"
        placeholder="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <select
        value={formData.classification}
        onChange={(e) =>
          setFormData({ ...formData, classification: Number(e.target.value) })
        }
      >
        <option value={0}>Select Classification</option>
        <option value={1}>Classification 1</option>
        <option value={2}>Classification 2</option>
      </select>
      <button onClick={handleSubmit}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default FutureRoadDialog;
