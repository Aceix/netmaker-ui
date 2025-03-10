import { Host } from '@/models/Host';
import { Network } from '@/models/Network';
import { Node } from '@/models/Node';
import { useLoadGraph, useSigma } from '@react-sigma/core';
import Graph from 'graphology';
import { useCallback, useEffect } from 'react';
import circular from 'graphology-layout/circular';
// import forceAtlas from 'graphology-layout-force';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import ForceSupervisor from 'graphology-layout-force/worker';
import { NodeAclContainer } from '@/models/Acl';
import { ExternalClient } from '@/models/ExternalClient';
import { theme } from 'antd';
import { useStore } from '@/store/store';
import { NULL_HOST } from '@/constants/Types';

interface NetworkGraphProps {
  network: Network;
  hosts: Host[];
  nodes: Node[];
  acl: NodeAclContainer;
  clients: ExternalClient[];
}

type GraphPositioningStrategy = 'circular' | 'forceatlas' | 'forceatlas2';

const DISCONNECTED_EDGE_COLOR = '#F00';
const HOST_COLOR = '#6E44CB';
const HOST_EDGE_COLOR = '#888';
const CLIENT_COLOR = '#6B81CA';
const CLIENT_EDGE_COLOR = '#6B81CA';
const EGRESS_RANGE_COLOR = '#52712E';
const EGRESS_RANGE_EDGE_COLOR = '#52712E';

const HOST_NODE_SIZE = 15;
const HOST_EDGE_SIZE = 3;
const EGRESS_NODE_SIZE = 20;
const EGRESS_EDGE_SIZE = 5;
const EGRESS_RANGE_EDGE_SIZE = 5;
const EGRESS_RANGE_SIZE = 20;
const CLIENT_NODE_SIZE = 10;
const CLIENT_EDGE_SIZE = 1;

const EGRESS_RANGE_PREFIX = 'egress-range-';

let forceAtlasWorkerRef: ForceSupervisor | null = null;

export default function NetworkGraph({ hosts, nodes, acl, clients }: NetworkGraphProps) {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();
  const { token: themeToken } = theme.useToken();
  const store = useStore();

  // use this for zoom level
  // sigma.getCamera().getState().ratio

  // node label color
  sigma.setSetting('labelColor', {
    color: store.currentTheme === 'dark' ? themeToken.colorPrimary : themeToken.colorText,
  });

  const canNodesCommunitcate = useCallback(
    (a: Node, b: Node): boolean => {
      if (acl?.[a.id]?.[b.id] === 2 && acl?.[b.id]?.[a.id] === 2) {
        return true;
      }
      return false;
    },
    [acl]
  );

  const renderNodes = useCallback(
    (graph: Graph, nodes: Node[], nodeToHostMap: Record<Node['id'], Host>, clients: ExternalClient[]) => {
      nodes.forEach((node) => {
        const nodeLabel = nodeToHostMap[node.id].name;

        // all nodes
        graph.addNode(node.id, {
          x: Math.round(Math.random() * 100),
          y: Math.round(Math.random() * 100),
          size: node.isegressgateway ? EGRESS_NODE_SIZE : HOST_NODE_SIZE,
          label: nodeLabel,
          color: HOST_COLOR,
        });

        // add egress ranges
        if (node.isegressgateway) {
          graph.addNode(`${EGRESS_RANGE_PREFIX}${node.id}`, {
            x: Math.round(Math.random() * 100),
            y: Math.round(Math.random() * 100),
            size: EGRESS_RANGE_SIZE,
            label: node.egressgatewayranges.join(','),
            color: EGRESS_RANGE_COLOR,
          });
        }
      });

      // add clients
      clients.forEach((client) => {
        const nodeLabel = client.clientid;

        graph.addNode(client.clientid, {
          x: Math.round(Math.random() * 100),
          y: Math.round(Math.random() * 100),
          size: CLIENT_NODE_SIZE,
          label: nodeLabel,
          color: CLIENT_COLOR,
        });
      });
    },
    []
  );

  const renderEdges = useCallback(
    (graph: Graph, nodes: Node[], nodeToHostMap: Record<Node['id'], Host>, clients: ExternalClient[]) => {
      // connect mesh nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes.length; j++) {
          graph.addEdge(nodes[i].id, nodes[j].id, {
            color: canNodesCommunitcate(nodes[i], nodes[j]) ? HOST_EDGE_COLOR : DISCONNECTED_EDGE_COLOR,
            size: HOST_EDGE_SIZE,
            type: 'arrow',
          });
        }
      }

      // connect clients to their ingress
      clients.forEach((client) => {
        graph.addEdge(client.clientid, client.ingressgatewayid, {
          color: CLIENT_EDGE_COLOR,
          size: CLIENT_EDGE_SIZE,
          type: 'arrow',
        });
      });

      // connect egress ranges to their egress
      graph.forEachNode((egressRangeGraphNodeId) => {
        if (egressRangeGraphNodeId.startsWith(EGRESS_RANGE_PREFIX)) {
          const egressNodeId = egressRangeGraphNodeId.replace(EGRESS_RANGE_PREFIX, '');
          graph.addEdge(egressNodeId, egressRangeGraphNodeId, {
            color: EGRESS_RANGE_EDGE_COLOR,
            size: EGRESS_RANGE_EDGE_SIZE,
            type: 'arrow',
          });
        }
      });
    },
    [canNodesCommunitcate]
  );

  const autoPositionGraphNodes = useCallback((graph: Graph, strategy: GraphPositioningStrategy) => {
    // always use circular to get initial positioning
    circular.assign(graph);
    if (strategy === 'circular') {
      return;
    } else if (strategy === 'forceatlas') {
      const forceAtlasWorker = new ForceSupervisor(graph, {
        // maxIterations: 50,
        settings: {
          gravity: 10,
        },
        onConverged() {
          console.log('converged');
        },
      });
      forceAtlasWorkerRef = forceAtlasWorker;
      forceAtlasWorker.start();
      // forceAtlas.assign(graph);
    } else if (strategy === 'forceatlas2') {
      const graphSettings = forceAtlas2.inferSettings(graph);
      forceAtlas2.assign(graph, { iterations: 600, settings: graphSettings });
    }
  }, []);

  useEffect(() => {
    const graph = new Graph();

    const nodeToHostMap = nodes.reduce((acc, node) => {
      acc[node.id] = hosts.find((host) => host.id === node.hostid) ?? NULL_HOST;
      return acc;
    }, {} as Record<Node['id'], Host>);

    const sortedNodes = structuredClone(nodes).sort((a, b) => a.id.localeCompare(b.id));
    const sortedClient = structuredClone(clients).sort((a, b) => a.clientid.localeCompare(b.clientid));

    renderNodes(graph, sortedNodes, nodeToHostMap, sortedClient);
    renderEdges(graph, sortedNodes, nodeToHostMap, sortedClient);

    autoPositionGraphNodes(graph, 'circular');

    circular.assign(graph);

    loadGraph(graph);

    return () => {
      // kill force atlas worker on unmount
      if (forceAtlasWorkerRef && forceAtlasWorkerRef.isRunning()) {
        forceAtlasWorkerRef.kill();
      }
    };
  }, [autoPositionGraphNodes, clients, hosts, loadGraph, nodes, renderEdges, renderNodes]);

  return null;
}
