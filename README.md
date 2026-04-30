# NITW_Navigation_webgis
WebGIS-based campus navigation system for NIT Warangal using OpenLayers, featuring shortest path routing, interactive layers, and real-time map visualization.

## Key Features
- Multiple base maps (OSM Standard, Humanitarian, Cycle)
- Thematic layers: buildings, roads, and campus boundary
- Shortest path routing using Dijkstra’s algorithm
- Dynamic source and destination selection
- Feature highlighting with labels
- Responsive and user-friendly interface

## Technical Stack
- OpenLayers (Web Mapping Library)
- JavaScript (Routing logic + UI interaction)
- HTML & CSS (Frontend layout)
- GeoJSON (Spatial data)

## Functionality
The system constructs a graph from road network data and applies Dijkstra’s algorithm to compute optimal routes between selected nodes. It also integrates building-level interaction and visual feedback for enhanced usability.

## Use Case
Designed as an academic and practical implementation of WebGIS concepts, this project demonstrates spatial data handling, network analysis, and frontend map development.

## Future Improvements
- Real-time GPS-based navigation
- Turn-by-turn directions
- Backend integration (PostGIS / APIs)
- Mobile optimization

## Author
Gadari Vandana
