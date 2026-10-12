import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../../app/AppContext';
import { Card, Field, Heading } from '../../components/ui';
import { useResource } from '../../hooks/useResource';
import { mutate } from '../../services/api';
import { ResourceState } from '../workflows/shared';
import PolicyRichEditor from '../../components/PolicyRichEditor';

function PolicyEditor({
  id,
  initialPolicy,
  format,
}: {
  id: string;
  initialPolicy: string;
  format: string;
}) {
  const [policy, setPolicy] = useState(initialPolicy),
    [busy, setBusy] = useState(false);
  const { notify } = useApp();
  async function save() {
    if (policy.length > 10000)
      return notify('Policy is too long. Please shorten the content before saving.');
    setBusy(true);
    try {
      await mutate(`/providers/${id}/cancellation-policy`, 'PATCH', { policy, format: 'html' });
      notify('Cancellation policy saved');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to save policy');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <fieldset className="form-reset" disabled={busy}>
        <Field label="Your cancellation policy" full>
          <PolicyRichEditor
            initialValue={initialPolicy}
            format={format}
            disabled={busy}
            onChange={setPolicy}
          />
        </Field>
        <p className="sub">
          Patients can read this policy from their booking summary. Save an empty policy to remove
          the published text.
        </p>
        <button className="btn space-top">{busy ? 'Saving…' : 'Save cancellation policy'}</button>
      </fieldset>
    </form>
  );
}
export default function CancellationPolicyPage({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useApp();
  const params = useParams();
  const id = readOnly ? params.providerId : user?.entityId;
  const resource = useResource<{
    provider: {
      id: string;
      full_name: string;
      cancellation_policy: string | null;
      cancellation_policy_format: string;
    };
  }>(`/providers/${id}/cancellation-policy`);
  return (
    <section>
      {!readOnly && <Heading
        title="Cancellation policy"
        subtitle={
          readOnly
            ? resource.value?.provider.full_name || 'Provider cancellation policy'
            : 'Set the policy patients can read before confirming their booking.'
        }
      />}
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        retry={() => void resource.reload()}
      />
      {resource.value && (
        <Card title={readOnly ? resource.value.provider.full_name : 'Policy details'}>
          {readOnly ? (
            resource.value.provider.cancellation_policy ? (
              <PolicyRichEditor
                key={resource.value.provider.cancellation_policy}
                initialValue={resource.value.provider.cancellation_policy}
                format={resource.value.provider.cancellation_policy_format}
                readOnly
              />
            ) : (
              <p>
                This provider has not added a cancellation policy yet. Please contact the provider
                for cancellation terms.
              </p>
            )
          ) : (
            <PolicyEditor
              key={resource.value.provider.id}
              id={resource.value.provider.id}
              format={resource.value.provider.cancellation_policy_format}
              initialPolicy={resource.value.provider.cancellation_policy || ''}
            />
          )}
        </Card>
      )}
    </section>
  );
}
