/**
 * Compatibility Engine
 * Checks compatibility rules between a donation and a receiver profile.
 * Rejects with a clear, specific message when requirements are not satisfied.
 */
export function checkCompatibility({ donation, receiver, requestedQuantity = 0 }) {
  // 1. Cooking facilities check
  if (donation.requires_cooking && !receiver.cooking_facilities) {
    return {
      isCompatible: false,
      reason: 'Incompatible facilities: This donation contains raw rations/ingredients requiring cooking facilities, which the receiver shelter does not possess.'
    };
  }

  // 2. Clean water check
  if (donation.requires_clean_water && !receiver.clean_water) {
    return {
      isCompatible: false,
      reason: 'Incompatible sanitation: This food item requires clean potable water preparation, which is currently unavailable at this facility.'
    };
  }

  // 3. Infant formula / sensitive item check
  if (donation.item_type === 'infant_formula' && !receiver.clean_water) {
    return {
      isCompatible: false,
      reason: 'Safety restriction: Infant formula strictly requires verified clean water facilities for preparation.'
    };
  }

  // 4. Storage capacity check
  if (requestedQuantity > 0 && receiver.storage_capacity && requestedQuantity > receiver.storage_capacity) {
    return {
      isCompatible: false,
      reason: `Capacity exceeded: Requested quantity (${requestedQuantity}) exceeds shelter's total maximum storage capacity (${receiver.storage_capacity}).`
    };
  }

  // 5. Remaining demand check
  if (receiver.current_demand !== undefined && receiver.current_demand <= 0) {
    return {
      isCompatible: false,
      reason: 'No remaining demand: Shelter currently has zero open demand.'
    };
  }
  if (requestedQuantity > 0 && receiver.current_demand !== undefined && requestedQuantity > receiver.current_demand) {
    return {
      isCompatible: false,
      reason: `Demand limit exceeded: Requested quantity (${requestedQuantity}) exceeds shelter's active remaining demand (${receiver.current_demand}).`
    };
  }

  // 6. Operating hours check (check estimated arrival time if provided, or current time)
  if (receiver.operating_hours && receiver.operating_hours.includes('-')) {
    try {
      const parts = receiver.operating_hours.split('-').map(s => s.trim());
      if (parts.length === 2) {
        const [startStr, endStr] = parts;
        const [startH, startM] = startStr.split(':').map(Number);
        const [endH, endM] = endStr.split(':').map(Number);

        const checkTime = arguments[0]?.estimatedArrival ? new Date(arguments[0].estimatedArrival) : new Date();
        const checkMins = checkTime.getHours() * 60 + checkTime.getMinutes();
        const startMins = startH * 60 + (startM || 0);
        const endMins = endH * 60 + (endM || 0);

        if (endMins > startMins) {
          if (checkMins < startMins || checkMins > endMins) {
            return {
              isCompatible: false,
              reason: `Outside operating hours: Shelter operates between ${receiver.operating_hours}. Estimated arrival (${checkTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) falls outside operating hours.`
            };
          }
        }
      }
    } catch {
      // ignore parse errors and proceed
    }
  }

  return {
    isCompatible: true,
    reason: null
  };
}
