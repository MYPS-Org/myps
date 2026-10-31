// =============================================================================
// AddPlanningProject.tsx — add a planning project to an open RDIP or UDIP
// (/multi-year/portfolios/:portfolioId/add-project, MY-PFL-16).
//
// The server makes the one lasting record with an MY Project ID, its CW1
// component, its planned yearly costs (marked Planned) and the owner membership,
// status New. The checks below are the server's, run first so the user hears
// about a problem before the round trip; the server still decides.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { MembershipFields, PlanningFormOptions, PlanningProjectFields } from '../Model.d';
import * as Service from '../Service';
import PlanningProjectForm from '../components/PlanningProjectForm';
import MembershipFieldsEditor from '../components/MembershipFieldsEditor';
import { EMPTY_MEMBERSHIP, planningFormRefusal } from '../rules';

const AddPlanningProject: React.FC = () => {
  const { portfolioId } = useParams();
  const id = Number(portfolioId);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [options, setOptions] = useState<PlanningFormOptions | null>(null);
  const [fields, setFields] = useState<PlanningProjectFields | null>(null);
  const [membership, setMembership] = useState<MembershipFields>(EMPTY_MEMBERSHIP);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Service.fetchPlanningFormOptions(id)
      .then((r) => {
        const o = r.Data;
        const start = Math.max(o.Portfolio.TermStartYear, new Date().getFullYear());
        setOptions(o);
        setFields({
          Description: '',
          Category: 0,
          Thrust: null,
          Region: o.Portfolio.Kind === 1 ? o.Portfolio.OwnerParticipantId : null,
          Province: null,
          City: null,
          LegislativeDistrict: null,
          DEO: null,
          ImplementingOffice: o.Portfolio.Kind === 2 ? o.Portfolio.OwnerParticipantId : null,
          ReportingRegion: null,
          RegionWide: null,
          HorizonTypeId: o.HorizonTypes.find((h) => h.Years === 6)?.Id ?? 0,
          StartYear: start,
          EndYear: null,
          Component: { Description: '', InfraTypeFK: '', WorkTypeFK: 0, PhysicalTarget: null },
          YearlyCosts: [{ Year: start, Amount: NaN }],
        });
      })
      .catch(() => undefined);
  }, [id]);

  if (!options || !fields) return <div className="flex justify-center py-8 text-gray-500">Loading form...</div>;

  const submit = async () => {
    const refusal = planningFormRefusal(fields, options);
    if (refusal) {
      showToast({ type: 'error', message: refusal });
      return;
    }
    if (fields.StartYear < options.Portfolio.TermStartYear) {
      showToast({ type: 'error', message: `A new planning project in ${options.Portfolio.Term} starts in ${options.Portfolio.TermStartYear} or later.` });
      return;
    }
    setSaving(true);
    try {
      const response = await Service.addPlanningProject({ ...fields, PortfolioId: id, Membership: membership });
      showToast({ type: 'success', message: response.Data.Message });
      response.Data.Warnings.forEach((w) => showToast({ type: 'warning', message: w }));
      navigate(`/multi-year/projects/${response.Data.ProjectId}`);
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Failed to add the planning project. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
        <Link to={`/multi-year/portfolios/${id}`} className="text-sm text-blue-600 hover:underline">{options.Portfolio.Name}</Link>
        <h3 className="text-lg font-medium text-gray-900">Add Planning Project</h3>
        <p className="text-sm text-gray-500">The project gets an MY Project ID when it is saved. Its status in {options.Portfolio.Name} starts as New.</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <PlanningProjectForm options={options} value={fields} onChange={setFields} mode="add" canEditStartYear />
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h4 className="text-base font-semibold text-gray-900">Planning fields in {options.Portfolio.Name}</h4>
        <MembershipFieldsEditor value={membership} onChange={setMembership} options={options} year={fields.StartYear} />
      </div>
      <div className="flex justify-end gap-3">
        <Button outline onClick={() => navigate(`/multi-year/portfolios/${id}`)}>Cancel</Button>
        <Button color="green" onClick={submit} disabled={saving}>Add Planning Project</Button>
      </div>
    </div>
  );
};

export default AddPlanningProject;
