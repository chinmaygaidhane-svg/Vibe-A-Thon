import React from 'react';
import { Clock, UserCheck, PackageCheck, Truck, CheckCircle2 } from 'lucide-react';

export default function StatusTimeline({ status }) {
  const steps = [
    { key: 'REQUESTED', label: 'Requested', icon: Clock },
    { key: 'ASSIGNED', label: 'Rider Assigned', icon: UserCheck },
    { key: 'PICKED_UP', label: 'Collected', icon: PackageCheck },
    { key: 'IN_TRANSIT', label: 'In Transit', icon: Truck },
    { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 }
  ];

  const getStepIndex = (st) => {
    if (!st) return 0;
    const s = st.toUpperCase();
    if (s === 'DELIVERED') return 4;
    if (s === 'IN_TRANSIT') return 3;
    if (s === 'PICKED_UP') return 2;
    if (s === 'RIDER_GOING_TO_PICKUP' || s === 'GOING_TO_PICKUP' || s === 'ASSIGNED') return 1;
    return 0;
  };

  const currentIndex = getStepIndex(status);

  return (
    <div className="timeline-stepper">
      <div className="timeline-line-bg" />
      <div
        className="timeline-line-active"
        style={{ width: `${(currentIndex / (steps.length - 1)) * 90}%` }}
      />

      {steps.map((s, idx) => {
        const Icon = s.icon;
        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;

        return (
          <div
            key={s.key}
            className={`timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
          >
            <div className="timeline-node">
              <Icon size={16} />
            </div>
            <span className="timeline-label">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
