import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { bridgesAtom, selectedItemAtom, type Bridge } from "../state/rbiaAtoms";

const FutureBridgeDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [bridges, setBridges] = useAtom(bridgesAtom);
  const [selectedItem] = useAtom(selectedItemAtom);
  const [formData, setFormData] = useState<Bridge>({
    roadId: "",
    sectionRoadId: "",
    name: "",
    from: 0,
    length: 0,
    carriageWay: 0,
  });

  useEffect(() => {
    if (selectedItem && 'carriageWay' in selectedItem) {
      setFormData(selectedItem as Bridge); // Populate form with selected item for editing
    }
  }, [selectedItem]);

  const handleSubmit = () => {
    if (selectedItem) {
      // Edit existing bridge
      setBridges(
        bridges.map((bridge: Bridge) =>
          bridge.sectionRoadId === (selectedItem as Bridge).sectionRoadId ? formData : bridge
        )
      );
    } else {
      // Create new bridge
      setBridges([...bridges, formData]);
    }
    onClose();
  };

  return (
    <div className="dialog">
      <h2>{selectedItem ? "Edit Future Bridge" : "Create Future Bridge"}</h2>
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
        type="text"
        placeholder="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <input
        type="number"
        placeholder="From"
        value={formData.from}
        onChange={(e) => setFormData({ ...formData, from: Number(e.target.value) })}
      />
      <input
        type="number"
        placeholder="Length"
        value={formData.length}
        onChange={(e) => setFormData({ ...formData, length: Number(e.target.value) })}
      />
      <input
        type="number"
        placeholder="Carriage Way"
        value={formData.carriageWay}
        onChange={(e) => setFormData({ ...formData, carriageWay: Number(e.target.value) })}
      />
      <button onClick={handleSubmit}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default FutureBridgeDialog;
