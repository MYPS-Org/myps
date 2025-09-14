import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { roadSectionsAtom, selectedItemAtom, type RoadSection } from "../state/rbiaAtoms";

const FutureRoadSectionDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [futureRoadSections, setFutureRoadSections] = useAtom(roadSectionsAtom);
  const [selectedItem] = useAtom(selectedItemAtom);
  const [formData, setFormData] = useState<RoadSection>({
    roadId: "",
    sectionRoadId: "",
    length: 0,
    engineeringDistrict: 0,
  });

  useEffect(() => {
    if (selectedItem && 'sectionRoadId' in selectedItem) {
      setFormData(selectedItem as RoadSection); // Populate form with selected item for editing
    }
  }, [selectedItem]);

  const handleSubmit = () => {
    if (!formData.sectionRoadId.startsWith("FR")) {
      alert("Section Road ID must start with 'FR'");
      return;
    }
    if (selectedItem) {
      // Edit existing road section
      setFutureRoadSections(
        futureRoadSections.map((section: RoadSection) =>
          section.sectionRoadId === (selectedItem as RoadSection).sectionRoadId ? formData : section
        )
      );
    } else {
      // Create new road section
      setFutureRoadSections([...futureRoadSections, formData]);
    }
    onClose();
  };

  return (
    <div className="dialog">
      <h2>{selectedItem ? "Edit Future Road Section" : "Create Future Road Section"}</h2>
      <input
        type="text"
        placeholder="Road ID"
        value={formData.roadId}
        onChange={(e) => setFormData({ ...formData, roadId: e.target.value })}
      />
      <input
        type="text"
        placeholder="Section Road ID"
        value={formData.sectionRoadId}
        onChange={(e) => setFormData({ ...formData, sectionRoadId: e.target.value })}
      />
      <input
        type="number"
        placeholder="Length"
        value={formData.length}
        onChange={(e) => setFormData({ ...formData, length: Number(e.target.value) })}
      />
      <select
        value={formData.engineeringDistrict}
        onChange={(e) =>
          setFormData({ ...formData, engineeringDistrict: Number(e.target.value) })
        }
      >
        <option value={0}>Select Engineering District</option>
        <option value={1}>District 1</option>
        <option value={2}>District 2</option>
      </select>
      <button onClick={handleSubmit}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default FutureRoadSectionDialog;
