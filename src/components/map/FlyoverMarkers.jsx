import { Popup, Marker } from "react-leaflet";
import { FadeInGeoJSON, makeFlyoverIcon, getPointDetailFields, formatPointName } from "./mapHelpers";
import WeatherPopupCard from "../WeatherPopupCard";

export default function FlyoverMarkers({
  flyoverMarkers,
  visibleFlyoverIds,
  isDetailZoom,
  isFullscreen,
  weather,
  weatherLoading,
  onSelectHighway,
  onSelectPoint,
}) {
  const visible = flyoverMarkers.filter((f) => visibleFlyoverIds.has(f.id));

  return (
    <>
      {/* Boundary — one per highway, own color. Clicking it still selects
          the highway for the details panel, even though there's no pin
          sitting on top of it anymore. */}
      {visible.map((flyover) => (
        <FadeInGeoJSON
          key={`line-${flyover.id}`}
          data={flyover.geojson}
          style={{ color: flyover.color, weight: 4, opacity: 1 }}
          onEachFeature={(feature, layer) => {
            layer.on("click", () => onSelectHighway(flyover));
          }}
        />
      ))}

      {/* Only named-point markers — this is the single source of pins on
          the map now, so there's no way for two markers to land on the
          same spot. */}
      {visible.flatMap((flyover) =>
        (flyover.namedPoints || []).map((point) => {
          const displayName = formatPointName(point.name);
          return (
            <Marker
              key={`point-${flyover.id}-${point.id}`}
              position={point.latlng}
              icon={makeFlyoverIcon({
                color: flyover.color,
                labelText: displayName,
                detailed: isDetailZoom,
                name: displayName,
                detailFields: getPointDetailFields(point),
              })}
              eventHandlers={{ click: () => onSelectPoint(point, flyover) }}
            >
              {isFullscreen && (
                <Popup className="weather-popup" closeButton autoPan offset={[0, -6]}>
                  <WeatherPopupCard weather={weather} loading={weatherLoading} />
                </Popup>
              )}
            </Marker>
          );
        }),
      )}
    </>
  );
}