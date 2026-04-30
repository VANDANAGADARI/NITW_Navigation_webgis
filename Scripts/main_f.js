window.onload = init;

let map, buildingLayer, centroidLayer, routeLayer, roadLayer, highlightLayer;

// ================= GRAPH =================
let graph = {};
let roadNodes = [];

function init(){

// ================= MAP =================
map = new ol.Map({
    target: "js-map",
    view: new ol.View({
        center: ol.proj.fromLonLat([79.5, 18.0]),
        zoom: 16
    })
});

// ================= BASE LAYERS =================
const OSMStandard = new ol.layer.Tile({
    source: new ol.source.OSM(),
    visible: false,
    title: 'OSMStandard'
});

const OSMHumanitarian = new ol.layer.Tile({
    source: new ol.source.OSM({
        url:'https://{a-c}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'
    }),
    visible: false,
    title:'OSMHumanitarian'
});

const OSMCycle = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url:'https://{a-c}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'
    }),
    visible: true,
    title:'OSMCycle'
});

const baseGroup = new ol.layer.Group({
    layers:[OSMStandard,OSMHumanitarian,OSMCycle]
});
map.addLayer(baseGroup);

document.querySelectorAll("input[name=baseLayerRadioButton]").forEach(el=>{
    el.addEventListener("change", function(){
        baseGroup.getLayers().forEach(l=>{
            l.setVisible(l.get("title") === this.value);
        });
    });
});

// ================= ROAD STYLE =================
const roadStyle = [
    new ol.style.Style({
        stroke:new ol.style.Stroke({color:"#fff",width:6})
    }),
    new ol.style.Style({
        stroke:new ol.style.Stroke({
            color:"#444",
            width:3,
            lineDash:[3,6]
        })
    })
];

// ================= LAYERS =================
const boundaryLayer = new ol.layer.Vector({
    source:new ol.source.Vector({
        url:"../data_webgis/boundary_nitw.geojson",
        format:new ol.format.GeoJSON()
    }),
    title:"GeoJSONLayer1"
});

buildingLayer = new ol.layer.Vector({
    source:new ol.source.Vector({
        url:"../data_webgis/buildings_nitw.geojson",
        format:new ol.format.GeoJSON()
    }),
    title:"GeoJSONLayer2"
});

roadLayer = new ol.layer.Vector({
    source:new ol.source.Vector({
        url:"../data_webgis/roads_nitw.geojson",
        format:new ol.format.GeoJSON()
    }),
    style:roadStyle,
    title:"GeoJSONLayer3"
});

centroidLayer = new ol.layer.Vector({
    source:new ol.source.Vector({
        url:"../data_webgis/centroid_routing.geojson",
        format:new ol.format.GeoJSON()
    })
});

// highlight layer (simple, no style override)
highlightLayer = new ol.layer.Vector({
    source:new ol.source.Vector()
});

routeLayer = new ol.layer.Vector({
    source:new ol.source.Vector(),
    style:[
        new ol.style.Style({
            stroke:new ol.style.Stroke({color:"white",width:8})
        }),
        new ol.style.Style({
            stroke:new ol.style.Stroke({color:"#007bff",width:4})
        })
    ]
});

// ================= ADD LAYERS =================
map.addLayer(boundaryLayer);
map.addLayer(roadLayer);
map.addLayer(buildingLayer);

// hide centroid
centroidLayer.setStyle(new ol.style.Style(null));
map.addLayer(centroidLayer);

map.addLayer(highlightLayer);
map.addLayer(routeLayer);

// ================= GRAPH =================
roadLayer.getSource().on("change", ()=>{
    if(roadLayer.getSource().getState()==="ready"){
        buildGraph(roadLayer.getSource().getFeatures());
    }
});

// ================= DROPDOWN =================
centroidLayer.getSource().on("change", ()=>{
    if(centroidLayer.getSource().getState()==="ready"){
        const feats=centroidLayer.getSource().getFeatures();
        const s=document.getElementById("source");
        const d=document.getElementById("destination");

        feats.forEach(f=>{
            const n=f.get("name");
            if(n){
                s.add(new Option(n,n));
                d.add(new Option(n,n));
            }
        });
    }
});

// ================= ROUTING =================
window.findRoute = ()=>{

    const s=document.getElementById("source").value;
    const d=document.getElementById("destination").value;

    const feats=centroidLayer.getSource().getFeatures();

    let sf, df;
    feats.forEach(f=>{
        if(f.get("name")===s) sf=f;
        if(f.get("name")===d) df=f;
    });

    if(!sf || !df){
        alert("Invalid selection");
        return;
    }

    const start=getNearestNode(sf.getGeometry().getCoordinates());
    const end=getNearestNode(df.getGeometry().getCoordinates());

    const path=dijkstra(start,end);

    if(path.length===0){
        alert("No route found!");
        return;
    }

    routeLayer.getSource().clear();
    highlightLayer.getSource().clear();

    // ================= 🔥 HIGHLIGHT + LABEL =================
    buildingLayer.getSource().getFeatures().forEach(b=>{
        const name = b.get("name");

        if(name === s || name === d){

            const clone = b.clone();
            const geom = clone.getGeometry();

            let textPoint = geom;

            if(geom.getType() === "Polygon"){
                textPoint = geom.getInteriorPoint();
            }

            const highlightStyle = new ol.style.Style({
                stroke:new ol.style.Stroke({
                    color:"#ffcc00",
                    width:3
                }),
                fill:new ol.style.Fill({
                    color:"rgba(255,204,0,0.3)"
                })
            });

            const textStyle = new ol.style.Style({
                geometry: textPoint,
                text:new ol.style.Text({
                    text: name || "",
                    font: "bold 14px Arial",
                    fill: new ol.style.Fill({ color: "#000" }),
                    stroke: new ol.style.Stroke({ color: "#fff", width: 3 }),
                    textAlign: "center",
                    textBaseline: "middle"
                })
            });

            clone.setStyle([highlightStyle, textStyle]);
            highlightLayer.getSource().addFeature(clone);
        }
    });

    const line=new ol.Feature({
        geometry:new ol.geom.LineString(path)
    });

    routeLayer.getSource().addFeature(line);

    map.getView().fit(line.getGeometry(),{
        padding:[100,100,100,100],
        maxZoom:18,
        duration:1000
    });
};

// ================= GRAPH FUNCTIONS =================
function buildGraph(features){

    graph={};
    roadNodes=[];

    features.forEach(f=>{
        const geom=f.getGeometry();
        let lines=[];

        if(geom.getType()==="LineString") lines=[geom.getCoordinates()];
        else lines=geom.getCoordinates();

        lines.forEach(coords=>{
            for(let i=0;i<coords.length-1;i++){
                const a=coords[i], b=coords[i+1];

                const ka=a.toString(), kb=b.toString();

                if(!graph[ka]) graph[ka]=[];
                if(!graph[kb]) graph[kb]=[];

                const d=distance(a,b);

                graph[ka].push({node:kb,weight:d});
                graph[kb].push({node:ka,weight:d});

                roadNodes.push(a,b);
            }
        });
    });
}

function distance(a,b){
    return Math.hypot(a[0]-b[0],a[1]-b[1]);
}

function getNearestNode(coord){
    let min=Infinity, near=null;
    roadNodes.forEach(n=>{
        const d=distance(coord,n);
        if(d<min){min=d;near=n;}
    });
    return near?near.toString():null;
}

function dijkstra(start,end){

    let dist={}, prev={}, Q=[];

    Object.keys(graph).forEach(n=>{
        dist[n]=Infinity;
        prev[n]=null;
        Q.push(n);
    });

    if(!start||!end) return [];

    dist[start]=0;

    while(Q.length){
        Q.sort((a,b)=>dist[a]-dist[b]);
        let u=Q.shift();

        if(u===end) break;
        if(!graph[u]) continue;

        graph[u].forEach(n=>{
            let alt=dist[u]+n.weight;
            if(alt<dist[n.node]){
                dist[n.node]=alt;
                prev[n.node]=u;
            }
        });
    }

    let path=[], u=end;
    while(u){
        path.unshift(u.split(',').map(Number));
        u=prev[u];
    }

    return path;
}
}