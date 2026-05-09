/**
 * RelationshipGraph V2 - 关系图固定窗口
 *
 * 核心：固定高度的画布窗口，展示网络结构（中心节点 + 径向分布子节点 + 连线）。
 * 支持拖拽平移 + 缩放 + 点击节点展开。
 * 企业关系图以项目为中心，人物关系图以"我"为中心。
 */
import React, { FC, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { Building2, Users, X, Camera } from 'lucide-react-native';
import { DayColors } from '@/constants';

const PROJECT_RED = '#B20000';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_HEIGHT = 320;

const NODE_COLORS = [
  '#C084FC', '#3BA8A0', '#3692A7', '#76A390',
  '#CCBB87', '#B080B0', '#78ACA0', '#C7B059',
];

interface EdgeInfo {
  sourceId: string;
  targetId: string;
  relation: string;
  edgeLevel: number;
}

interface Node {
  id: string;
  name: string;
  icon: string;
  level: number;
  parentId?: string;
  x: number;
  y: number;
  color: string;
  source?: string;
  relation?: string;
  expanded?: boolean;
  children?: Node[];
  details?: any;
  edges?: EdgeInfo[];
}

interface RelationshipGraphProps {
  graphTab: 'enterprise' | 'person';
  onGraphTabChange: (tab: 'enterprise' | 'person') => void;
  enterpriseNodes: any[];
  personNodes: any[];
  personEdges?: any[];
  projectName: string;
  loading?: boolean;
  onRefresh?: () => void;
  incrementData?: any;
  onIncrementUpdate?: (incrementData: any) => void;
  onAvatarUpload?: (personName: string) => void;
  onRebuildGraph?: () => void;
  rebuilding?: boolean;
}

const RelationshipGraph: FC<RelationshipGraphProps> = ({
  graphTab,
  onGraphTabChange,
  enterpriseNodes,
  personNodes,
  personEdges = [],
  projectName,
  loading = false,
  onRefresh,
  incrementData,
  onIncrementUpdate,
  onAvatarUpload,
  onRebuildGraph,
  rebuilding = false,
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [incrementNodes, setIncrementNodes] = useState<{enterprise: any[]; person: any[]}>({enterprise: [], person: []});
  const [personPopover, setPersonPopover] = useState<{visible: boolean; node: Node | null}>({visible: false, node: null});

  const handleIncrementUpdate = useCallback((data: { companies?: any[]; persons?: any[]; person_details?: any; person_relations?: any[] }) => {
    const newEnterpriseNodes = (data.companies || []).map(c => ({
      name: typeof c === 'string' ? c : c.name,
      source: '对话增量',
    }));
    const newPersonNodes = (data.persons || []).map(p => {
      const pName = typeof p === 'string' ? p : p.name;
      const details = data.person_details?.[pName];
      return {
        name: pName,
        role: details || '',
        relation: '朋友',
        source: '对话增量',
      };
    });
    setIncrementNodes(prev => ({
      enterprise: [...prev.enterprise, ...newEnterpriseNodes],
      person: [...prev.person, ...newPersonNodes],
    }));
  }, []);

  useEffect(() => {
    if (incrementData) {
      handleIncrementUpdate(incrementData);
    }
  }, [incrementData, handleIncrementUpdate]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const isZooming = useRef(false);
  const lastTapTime = useRef(0);
  const DOUBLE_TAP_DELAY = 300;

  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: graphTab === 'enterprise' ? 0 : 1,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();
  }, [graphTab]);

  // 当前数据源
  const activeNodes = useMemo(() => {
    const base = graphTab === 'enterprise' ? enterpriseNodes : personNodes;
    const incr = graphTab === 'enterprise' ? incrementNodes.enterprise : incrementNodes.person;
    const existingNames = new Set(base.map((n: any) => n.name));
    const uniqueIncr = incr.filter((n: any) => !existingNames.has(n.name));
    return [...base, ...uniqueIncr];
  }, [graphTab, enterpriseNodes, personNodes, incrementNodes]);

  // 颜色淡化函数（V1逻辑）
  const getFadedColor = (color: string, fadePercentage: number) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const factor = 1 - fadePercentage / 100;
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  // 节点展开切换
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // 构建节点 + 径向布局（使用edges构建层级关系）
  useEffect(() => {
    if (loading) { setNodes([]); return; }

    const builtNodes: Node[] = [];

    // 中心节点
    const centerId = 'center';
    const centerName = graphTab === 'person' ? '我' : '本项目';
    builtNodes.push({
      id: centerId,
      name: centerName,
      icon: graphTab === 'person' ? '👤' : '🏗️',
      level: 0,
      x: 0,
      y: 0,
      color: '#111827',
    });

    if (graphTab === 'person' && personEdges.length > 0) {
      console.log('📊 [RelationshipGraph] personEdges:', personEdges);
      console.log('📊 [RelationshipGraph] activeNodes:', activeNodes);
      
      // 使用edges构建层级关系图
      // 1. 创建节点ID到节点信息的映射
      const nodeMap = new Map<string, any>();
      activeNodes.forEach((n: any) => {
        if (n.id && n.name) {
          nodeMap.set(n.id, n);
        }
      });
      
      console.log('📊 [RelationshipGraph] nodeMap keys:', Array.from(nodeMap.keys()));
      console.log('📊 [RelationshipGraph] nodeMap entries:', Array.from(nodeMap.entries()).map(([k, v]) => ({ id: k, name: v.name })));

      // 2. 找到"我"节点的ID
      const meNode = activeNodes.find((n: any) => n.name === '我');
      const meId = meNode?.id;
      console.log('📊 [RelationshipGraph] meId:', meId);

      // 3. 先对 personEdges 去重（同一对节点之间只保留一条边，避免 LLM 返回 A→B 和 B→A 重复）
      const seenEdgePairs = new Set<string>();
      const dedupedEdges = personEdges.filter((edge: any) => {
        const sourceId = edge.source || edge.person_a_id;
        const targetId = edge.target || edge.person_b_id;
        if (!sourceId || !targetId) return false;
        const pairKey = [sourceId, targetId].sort().join('__');
        if (seenEdgePairs.has(pairKey)) return false;
        seenEdgePairs.add(pairKey);
        return true;
      });

      // 4. 构建邻接表（双向，基于去重后的 edges）
      const adjacency = new Map<string, { targetId: string; relation: string }[]>();
      dedupedEdges.forEach((edge: any) => {
        const sourceId = edge.source || edge.person_a_id;
        const targetId = edge.target || edge.person_b_id;
        const relation = edge.type || edge.relation_type || '其他';
        
        if (!adjacency.has(sourceId)) {
          adjacency.set(sourceId, []);
        }
        adjacency.get(sourceId)!.push({ targetId, relation });

        if (!adjacency.has(targetId)) {
          adjacency.set(targetId, []);
        }
        adjacency.get(targetId)!.push({ targetId: sourceId, relation });
      });
      
      console.log('📊 [RelationshipGraph] adjacency:', Array.from(adjacency.entries()));

      // 4. BFS构建层级
      const visited = new Set<string>();
      const levelNodes = new Map<number, any[]>(); // level -> nodes
      
      if (meId) {
        visited.add(meId);
        levelNodes.set(1, []);
        
        // 找到"我"的直接关系节点（level 1）
        const myRelations = adjacency.get(meId) || [];
        myRelations.forEach((rel, idx) => {
          if (!visited.has(rel.targetId)) {
            visited.add(rel.targetId);
            const nodeInfo = nodeMap.get(rel.targetId);
            if (nodeInfo) {
              levelNodes.get(1)!.push({
                ...nodeInfo,
                relation: rel.relation,
              });
            }
          }
        });
      }

      // 5. 找到 level 2 节点
      levelNodes.set(2, []);
      const level1Nodes = levelNodes.get(1) || [];
      console.log('📊 [RelationshipGraph] level1Nodes:', level1Nodes);
      level1Nodes.forEach((node) => {
        console.log('📊 [RelationshipGraph] checking level1 node:', node.id, node.name);
        const relations = adjacency.get(node.id) || [];
        console.log('📊 [RelationshipGraph] relations for node', node.id, ':', relations);
        relations.forEach((rel) => {
          console.log('📊 [RelationshipGraph] checking relation:', rel, 'visited:', visited.has(rel.targetId));
          if (!visited.has(rel.targetId)) {
            visited.add(rel.targetId);
            const nodeInfo = nodeMap.get(rel.targetId);
            console.log('📊 [RelationshipGraph] nodeInfo for targetId', rel.targetId, ':', nodeInfo);
            if (nodeInfo) {
              levelNodes.get(2)!.push({
                ...nodeInfo,
                relation: rel.relation,
                parentId: node.id,
              });
              console.log('📊 [RelationshipGraph] added to level 2:', nodeInfo.name);
            }
          }
        });
      });
      
      console.log('📊 [RelationshipGraph] levelNodes after BFS:', {
        level1: levelNodes.get(1),
        level2: levelNodes.get(2),
      });

      // 6. 径向布局
      // 先计算 Level 1 节点的位置
      const level1Positions = new Map<string, { x: number; y: number; angle: number }>();
      const level1NodesList = levelNodes.get(1) || [];
      const level1Radius = 90;
      
      level1NodesList.forEach((item, idx) => {
        const angle = (idx / Math.max(level1NodesList.length, 1)) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * level1Radius;
        const y = Math.sin(angle) * level1Radius;
        level1Positions.set(item.id, { x, y, angle });
      });

      // 渲染 Level 1 节点
      level1NodesList.forEach((item, idx) => {
        const pos = level1Positions.get(item.id)!;
        const nodeColor = NODE_COLORS[idx % NODE_COLORS.length];
        const nodeId = item.id || `node_1_${idx}`;

        const nodeEdges: EdgeInfo[] = [];
        const myRel = adjacency.get(meId) || [];
        myRel.forEach(r => {
          if (r.targetId === nodeId || r.targetId === item.id) {
            nodeEdges.push({ sourceId: centerId, targetId: nodeId, relation: r.relation, edgeLevel: 1 });
          }
        });

        const node: Node = {
          id: nodeId,
          name: item.name || '未知',
          icon: '👤',
          level: 1,
          parentId: centerId,
          x: pos.x,
          y: pos.y,
          color: nodeColor,
          source: item.source,
          relation: item.relation || item.relation_to_user,
          expanded: expandedNodes.has(nodeId),
          details: item.data || item,
          edges: nodeEdges,
        };

        console.log('📊 [RelationshipGraph] builtNode (level 1):', node.id, node.name, 'x:', node.x, 'y:', node.y);
        builtNodes.push(node);
      });

      // 渲染 Level 2 节点（围绕父节点分布）
      const level2NodesList = levelNodes.get(2) || [];
      const level2Radius = 70;

      level2NodesList.forEach((item, idx) => {
        const parentPos = level1Positions.get(item.parentId);
        let x: number, y: number;
        
        if (parentPos) {
          const childAngle = parentPos.angle + (Math.PI / 6);
          x = parentPos.x + Math.cos(childAngle) * level2Radius;
          y = parentPos.y + Math.sin(childAngle) * level2Radius;
        } else {
          const angle = (idx / Math.max(level2NodesList.length, 1)) * 2 * Math.PI - Math.PI / 2;
          x = Math.cos(angle) * 160;
          y = Math.sin(angle) * 160;
        }

        const nodeColor = NODE_COLORS[(idx + level1NodesList.length) % NODE_COLORS.length];
        const nodeId = item.id || `node_2_${idx}`;

        const nodeEdges: EdgeInfo[] = [];
        const parentRelations = adjacency.get(item.parentId) || [];
        parentRelations.forEach(r => {
          if (r.targetId === nodeId || r.targetId === item.id) {
            nodeEdges.push({ sourceId: item.parentId, targetId: nodeId, relation: r.relation, edgeLevel: 2 });
          }
        });
        const myDirectRel = adjacency.get(meId) || [];
        myDirectRel.forEach(r => {
          if (r.targetId === nodeId || r.targetId === item.id) {
            nodeEdges.push({ sourceId: centerId, targetId: nodeId, relation: r.relation, edgeLevel: 1 });
          }
        });

        const node: Node = {
          id: nodeId,
          name: item.name || '未知',
          icon: '👤',
          level: 2,
          parentId: item.parentId,
          x: x,
          y: y,
          color: nodeColor,
          source: item.source,
          relation: item.relation || item.relation_to_user,
          expanded: expandedNodes.has(nodeId),
          details: item.data || item,
          edges: nodeEdges,
        };

        console.log('📊 [RelationshipGraph] builtNode (level 2):', node.id, node.name, 'parentId:', item.parentId, 'x:', node.x, 'y:', node.y);
        builtNodes.push(node);
      });
      
      console.log('📊 [RelationshipGraph] total builtNodes:', builtNodes.length);
    } else {
      // 企业关系图或没有edges时使用原有逻辑
      const filtered = graphTab === 'person'
        ? activeNodes.filter((n: any) => n.name !== '我')
        : activeNodes;

      filtered.forEach((item: any, idx: number) => {
        const angle = (idx / Math.max(filtered.length, 1)) * 2 * Math.PI - Math.PI / 2;
        const radius = 100;
        const nodeColor = NODE_COLORS[idx % NODE_COLORS.length];
        
        const nodeId = item.id || `node_${idx}_${item.name}`;

        const node: Node = {
          id: nodeId,
          name: item.name || '未知',
          icon: graphTab === 'enterprise' ? '🏢' : '👤',
          level: 1,
          parentId: 'center',
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          color: nodeColor,
          source: item.source,
          relation: item.role || item.relation,
          expanded: expandedNodes.has(nodeId),
          details: item.details,
        };

        // 二级节点（企业详情）
        if (graphTab === 'enterprise' && item.details) {
          const children: Node[] = [];
          const childRadius = 48;
          const childNodes = [
            { id: '_info', name: '基本信息', icon: '📄' },
            { id: '_people', name: '人物', icon: '👤' },
            { id: '_qualification', name: '资质', icon: '📋' },
            { id: '_performance', name: '业绩', icon: '📊' },
          ];

          childNodes.forEach((child, cIdx) => {
            const childAngle = (cIdx / childNodes.length) * 2 * Math.PI + Math.PI / 4;
            children.push({
              id: `${nodeId}${child.id}`,
              name: child.name,
              icon: child.icon,
              level: 2,
              parentId: nodeId,
              x: node.x + Math.cos(childAngle) * childRadius,
              y: node.y + Math.sin(childAngle) * childRadius,
              color: getFadedColor(nodeColor, 40),
            });
          });

          node.children = children;
          builtNodes.push(...children);
        }

        builtNodes.push(node);
      });
    }

    setNodes(builtNodes);

    // 入场动画
    opacityAnim.setValue(0);
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeNodes, graphTab, loading, projectName, expandedNodes, personEdges]);

  // PanResponder (拖拽 + 双指缩放) - 只在背景层工作
  const getDistance = (touches: any[]) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => {
        return Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5 || gs.numberActiveTouches >= 2;
      },
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          isZooming.current = true;
          initialDistance.current = getDistance(evt.nativeEvent.touches);
          initialScale.current = scale;
        } else if (evt.nativeEvent.touches.length === 1) {
          isZooming.current = false;
          lastTranslateX.current = translateX;
          lastTranslateY.current = translateY;
        }
      },
      onPanResponderMove: (evt, gs) => {
        if (evt.nativeEvent.touches.length === 2 && isZooming.current) {
          const currentDistance = getDistance(evt.nativeEvent.touches);
          if (initialDistance.current > 0) {
            const newScale = Math.max(0.5, Math.min(3, initialScale.current * (currentDistance / initialDistance.current)));
            setScale(newScale);
            scaleAnim.setValue(newScale);
          }
        } else if (evt.nativeEvent.touches.length === 1 && !isZooming.current) {
          const newX = lastTranslateX.current + gs.dx;
          const newY = lastTranslateY.current + gs.dy;
          setTranslateX(newX);
          setTranslateY(newY);
          translateXAnim.setValue(newX);
          translateYAnim.setValue(newY);
        }
      },
      onPanResponderRelease: () => {
        isZooming.current = false;
        lastScale.current = scale;
        lastTranslateX.current = translateX;
        lastTranslateY.current = translateY;
      },
      onPanResponderTerminate: () => {
        isZooming.current = false;
      },
    })
  ).current;

  // 重置视图
  const handleReset = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    lastScale.current = 1;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateXAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(translateYAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  // 缩放按钮
  const handleZoom = (dir: 'in' | 'out') => {
    const newScale = dir === 'in' ? Math.min(scale + 0.15, 3) : Math.max(scale - 0.15, 0.5);
    setScale(newScale);
    lastScale.current = newScale;
    Animated.timing(scaleAnim, { toValue: newScale, duration: 200, useNativeDriver: true }).start();
  };

  const renderLines = () => {
    const visibleNodeIds = new Set<string>();
    nodes.forEach(node => {
      if (node.level === 0 || node.level === 1) {
        visibleNodeIds.add(node.id);
      } else if (node.level === 2) {
        if (graphTab === 'person') {
          visibleNodeIds.add(node.id);
        } else {
          const parent = nodes.find(n => n.id === node.parentId);
          if (parent && expandedNodes.has(parent.id)) {
            visibleNodeIds.add(node.id);
          }
        }
      }
    });

    const canvasW = SCREEN_WIDTH - 32;
    const canvasH = CANVAS_HEIGHT;
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    type EdgeEntry = {
      source: Node;
      target: Node;
      relation: string;
      edgeLevel: number;
    };

    const allEdges: EdgeEntry[] = [];

    nodes.forEach(node => {
      if (node.level <= 0 || !node.parentId) return;
      if (!visibleNodeIds.has(node.id)) return;
      const parent = nodes.find(n => n.id === node.parentId);
      if (!parent || !visibleNodeIds.has(parent.id)) return;

      if (node.edges && node.edges.length > 0) {
        node.edges.forEach(e => {
          if (visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId)) {
            const src = nodes.find(n => n.id === e.sourceId);
            const tgt = nodes.find(n => n.id === e.targetId);
            if (src && tgt) {
              allEdges.push({ source: src, target: tgt, relation: e.relation, edgeLevel: e.edgeLevel });
            }
          }
        });
      } else {
        const edgeLvl = node.level === 1 ? 1 : 2;
        allEdges.push({ source: parent, target: node, relation: node.relation || '', edgeLevel: edgeLvl });
      }
    });

    const pairKey = (a: string, b: string) => {
      return a < b ? `${a}__${b}` : `${b}__${a}`;
    };
    const pairCount = new Map<string, number>();
    allEdges.forEach(e => {
      const k = pairKey(e.source.id, e.target.id);
      pairCount.set(k, (pairCount.get(k) || 0) + 1);
    });
    const pairCursor = new Map<string, number>();

    const getLineStyle = (edgeLevel: number) => {
      if (edgeLevel === 1) {
        return { stroke: '#1F2937', strokeDasharray: '', opacity: 0.5 };
      } else if (edgeLevel === 2) {
        return { stroke: '#1F2937', strokeDasharray: '4,3', opacity: 0.45 };
      } else {
        return { stroke: '#9CA3AF', strokeDasharray: '2,5', opacity: 0.35 };
      }
    };

    const paths: React.ReactNode[] = [];

    allEdges.forEach((edge, idx) => {
      const k = pairKey(edge.source.id, edge.target.id);
      const total = pairCount.get(k) || 1;
      if (!pairCursor.has(k)) pairCursor.set(k, 0);
      const curIdx = pairCursor.get(k)!;
      pairCursor.set(k, curIdx + 1);

      const x1 = cx + edge.source.x;
      const y1 = cy + edge.source.y;
      const x2 = cx + edge.target.x;
      const y2 = cy + edge.target.y;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return;

      const style = getLineStyle(edge.edgeLevel);

      if (total === 1) {
        const d = `M${x1},${y1} L${x2},${y2}`;
        paths.push(
          <Path
            key={`edge_${idx}`}
            d={d}
            stroke={style.stroke}
            strokeWidth={1}
            strokeDasharray={style.strokeDasharray || undefined}
            opacity={style.opacity}
            fill="none"
          />
        );
        if (edge.relation) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const nx = -dy / dist;
          const ny = dx / dist;
          const labelOff = 8;
          paths.push(
            <SvgText
              key={`elabel_${idx}`}
              x={mx + nx * labelOff}
              y={my + ny * labelOff}
              fontSize={6}
              fill={style.stroke}
              opacity={style.opacity * 0.9}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {edge.relation}
            </SvgText>
          );
        }
      } else {
        const midOffset = 25;
        const sign = curIdx % 2 === 0 ? 1 : -1;
        const curvature = midOffset + Math.floor(curIdx / 2) * 18;
        const nx = -dy / dist;
        const ny = dx / dist;
        const cpx = (x1 + x2) / 2 + nx * sign * curvature;
        const cpy = (y1 + y2) / 2 + ny * sign * curvature;
        const d = `M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`;

        paths.push(
          <Path
            key={`edge_${idx}`}
            d={d}
            stroke={style.stroke}
            strokeWidth={1}
            strokeDasharray={style.strokeDasharray || undefined}
            opacity={style.opacity}
            fill="none"
          />
        );
        if (edge.relation) {
          const t = 0.5;
          const mx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpx + t * t * x2;
          const my = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpy + t * t * y2;
          paths.push(
            <SvgText
              key={`elabel_${idx}`}
              x={mx + nx * sign * 4}
              y={my + ny * sign * 4}
              fontSize={6}
              fill={style.stroke}
              opacity={style.opacity * 0.9}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {edge.relation}
            </SvgText>
          );
        }
      }
    });

    return (
      <Svg
        width={canvasW}
        height={canvasH}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        {paths}
      </Svg>
    );
  };

  // 渲染节点（支持展开交互）
  const renderNodes = () => {
    const visibleNodes = nodes.filter(node => {
      if (node.level === 0) return true;
      if (node.level === 1) return true;
      if (node.level === 2) {
        if (graphTab === 'person') {
          return true;
        }
        const parent = nodes.find(n => n.id === node.parentId);
        return parent ? expandedNodes.has(parent.id) : false;
      }
      return true;
    });

    return visibleNodes.map(node => {
      const isCenter = node.level === 0;
      const isLevel1 = node.level === 1;
      const size = isCenter ? 56 : isLevel1 ? 44 : 36;

      return (
        <View
          key={node.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: node.x - size / 2,
            marginTop: node.y - size / 2,
            width: size,
            alignItems: 'center',
            pointerEvents: 'auto',
            zIndex: isCenter ? 10 : isLevel1 ? 5 : 3,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              const now = Date.now();
              const isDoubleTap = now - lastTapTime.current < DOUBLE_TAP_DELAY;
              lastTapTime.current = now;
              
              if (isDoubleTap) {
                if (isLevel1 && graphTab === 'person') {
                  setPersonPopover({ visible: true, node });
                } else if (isLevel1) {
                  toggleNode(node.id);
                }
              }
            }}
            style={[
              isCenter ? styles.centerNode : isLevel1 ? styles.childNode : styles.tertiaryNode,
              {
                width: size,
                height: size,
                backgroundColor: node.color,
              },
            ]}
          >
            <Text style={isCenter ? styles.centerIcon : isLevel1 ? styles.childIcon : styles.tertiaryIcon}>
              {node.icon}
            </Text>
          </TouchableOpacity>
          <View style={{ position: 'absolute', top: size + 3, alignItems: 'center' }}>
            <Text
              style={isCenter ? styles.centerNameLabel : isLevel1 ? styles.childNameLabel : styles.tertiaryNameLabel}
              numberOfLines={1}
              ellipsizeMode="clip"
            >
              {node.name}
            </Text>
          </View>
        </View>
      );
    });
  };

  const hasData = nodes.length > 1;

  const renderPersonPopover = () => {
    if (!personPopover.visible || !personPopover.node) return null;
    const n = personPopover.node;
    return (
      <Modal
        transparent
        animationType="fade"
        visible={personPopover.visible}
        onRequestClose={() => setPersonPopover({ visible: false, node: null })}
      >
        <TouchableOpacity
          style={popoverStyles.overlay}
          activeOpacity={1}
          onPress={() => setPersonPopover({ visible: false, node: null })}
        >
          <View style={popoverStyles.card}>
            <View style={popoverStyles.header}>
              <View style={popoverStyles.avatarCircle}>
                {n.details?.avatar_url ? (
                  <Image source={{ uri: n.details.avatar_url }} style={popoverStyles.avatarImg} />
                ) : (
                  <Text style={popoverStyles.avatarPlaceholder}>👤</Text>
                )}
              </View>
              <View style={popoverStyles.headerInfo}>
                <Text style={popoverStyles.name}>{n.name}</Text>
                {n.relation && <Text style={popoverStyles.relation}>{n.relation}</Text>}
              </View>
              <TouchableOpacity onPress={() => setPersonPopover({ visible: false, node: null })} style={popoverStyles.closeBtn}>
                <X size={18} color={DayColors.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={popoverStyles.body}>
              {n.details?.position && (
                <View style={popoverStyles.row}>
                  <Text style={popoverStyles.label}>职务</Text>
                  <Text style={popoverStyles.value}>{n.details.position}</Text>
                </View>
              )}
              {n.relation && (
                <View style={popoverStyles.row}>
                  <Text style={popoverStyles.label}>与我的关系</Text>
                  <Text style={popoverStyles.value}>{n.relation}</Text>
                </View>
              )}
              {n.source && (
                <View style={popoverStyles.row}>
                  <Text style={popoverStyles.label}>来源</Text>
                  <Text style={popoverStyles.value}>{n.source}</Text>
                </View>
              )}
            </View>
            {onAvatarUpload && (
              <TouchableOpacity
                style={popoverStyles.avatarBtn}
                onPress={() => {
                  onAvatarUpload(n.name);
                  setPersonPopover({ visible: false, node: null });
                }}
              >
                <Camera size={16} color="#FFF" strokeWidth={2} />
                <Text style={popoverStyles.avatarBtnText}>设置头像</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={styles.wrapper}>
      {renderPersonPopover()}
      {/* 企业/人物切换 - 灰色背景容器 */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabsContainer}>
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                transform: [{
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, SCREEN_WIDTH / 2 - 16 - 2],
                  }),
                }],
              },
            ]}
          />
          <TouchableOpacity
            style={[styles.tab, graphTab === 'enterprise' && styles.tabActive]}
            onPress={() => onGraphTabChange('enterprise')}
          >
            <Building2
              size={14}
              color={graphTab === 'enterprise' ? '#FFF' : DayColors.textTertiary}
              strokeWidth={2}
            />
            <Text style={[styles.tabText, graphTab === 'enterprise' && styles.tabTextActive]}>
              企业关系图
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, graphTab === 'person' && styles.tabActive]}
            onPress={() => onGraphTabChange('person')}
          >
            <Users
              size={14}
              color={graphTab === 'person' ? '#FFF' : DayColors.textTertiary}
              strokeWidth={2}
            />
            <Text style={[styles.tabText, graphTab === 'person' && styles.tabTextActive]}>
              人物关系图
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 固定高度画布 */}
      <View style={styles.canvasContainer}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={PROJECT_RED} />
            <Text style={styles.emptyText}>加载关系数据...</Text>
          </View>
        ) : !hasData ? (
          // V1逻辑：即使无数据也显示中心节点+提示
          <View style={styles.canvas}>
            {nodes.filter(n => n.level === 0).map(node => {
              const size = 56;
              return (
                <View
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    marginLeft: node.x - size / 2,
                    marginTop: node.y - size / 2,
                    width: size,
                    alignItems: 'center',
                    zIndex: 10,
                  }}
                >
                  <View
                    style={[
                      styles.centerNode,
                      {
                        width: size,
                        height: size,
                        backgroundColor: node.color,
                      },
                    ]}
                  >
                    <Text style={styles.centerIcon}>{node.icon}</Text>
                  </View>
                  <View style={{ position: 'absolute', top: size + 3, alignItems: 'center' }}>
                    <Text style={styles.centerNameLabel} numberOfLines={1} ellipsizeMode="clip">{node.name}</Text>
                  </View>
                </View>
              );
            })}
            <View style={[styles.emptyState, { position: 'absolute', left: 0, right: 0, top: '65%' }]}>
              <Text style={styles.emptyTitle}>
                {graphTab === 'enterprise' ? '暂无企业数据' : '暂无人物数据'}
              </Text>
              <Text style={styles.emptyHint}>通过AI对话收集项目信息</Text>
            </View>
          </View>
        ) : (
          <View style={styles.canvas}>
            {/* 背景层：负责手势 */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: opacityAnim,
                  transform: [
                    { translateX: translateXAnim },
                    { translateY: translateYAnim },
                    { scale: scaleAnim },
                  ],
                },
              ]}
              {...panResponder.panHandlers}
            >
              {renderLines()}
            </Animated.View>
            {/* 节点层：独立响应点击 */}
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                opacity: opacityAnim,
                transform: [
                  { translateX: translateXAnim },
                  { translateY: translateYAnim },
                  { scale: scaleAnim },
                ],
              }}
              pointerEvents="box-none"
            >
              {renderNodes()}
            </Animated.View>
          </View>
        )}

        {/* 缩放控件 + 更新图谱 */}
        {hasData && !loading && (
          <View style={styles.controlsContainer}>
            {onRebuildGraph && (
              <TouchableOpacity
                style={[styles.rebuildBtn, rebuilding && styles.rebuildBtnDisabled]}
                onPress={onRebuildGraph}
                disabled={rebuilding}
                activeOpacity={0.7}
              >
                {rebuilding ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.rebuildBtnText}>更新图谱</Text>
                )}
              </TouchableOpacity>
            )}
            <View style={styles.controls}>
              <TouchableOpacity style={styles.controlBtn} onPress={() => handleZoom('out')}>
                <Text style={styles.controlText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.zoomLabel}>{Math.round(scale * 100)}%</Text>
              <TouchableOpacity style={styles.controlBtn} onPress={() => handleZoom('in')}>
                <Text style={styles.controlText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {},

  // Tab切换外层容器（白色背景）
  tabsWrapper: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },

  // Tab 切换
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 6,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    width: '50%',
    height: '100%',
    backgroundColor: '#000000',
    borderRadius: 6,
    left: 0,
    top: 0,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
    zIndex: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFF',
  },

  // 画布容器 (固定高度)
  canvasContainer: {
    height: CANVAS_HEIGHT,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: DayColors.surfaceSecondary,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  canvas: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },

  // 中心节点
  centerNode: {
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  centerIcon: { fontSize: 18 },
  centerNameLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: DayColors.textPrimary,
    marginTop: 4,
    textAlign: 'center',
  },

  // 子节点
  childNode: {
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  childIcon: { fontSize: 14 },
  childNameLabel: {
    fontSize: 7,
    fontWeight: '500',
    color: DayColors.textPrimary,
    marginTop: 3,
    textAlign: 'center',
    maxWidth: 88,
  },

  // 三级节点（V1新增）
  tertiaryNode: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  tertiaryIcon: { fontSize: 12 },
  tertiaryNameLabel: {
    fontSize: 6,
    fontWeight: '500',
    color: DayColors.textPrimary,
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 66,
  },

  // 空状态
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: DayColors.textSecondary },
  emptyText: { fontSize: 13, color: DayColors.textTertiary },
  emptyHint: { fontSize: 12, color: DayColors.textTertiary },

  // 控件
  controlsContainer: {
    position: 'absolute',
    bottom: 8, left: 8, right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rebuildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 4,
  },
  rebuildBtnDisabled: {
    opacity: 0.5,
  },
  rebuildBtnText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 12,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 4,
  },
  refreshText: { fontSize: 16, color: '#FFFFFF', lineHeight: 18 },
  refreshLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '500', lineHeight: 12 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 13,
    paddingHorizontal: 4,
  },
  controlBtn: {
    width: 20, height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  zoomLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', minWidth: 24, textAlign: 'center' },
});

const popoverStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DayColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    fontSize: 24,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: DayColors.text,
  },
  relation: {
    fontSize: 12,
    color: DayColors.textTertiary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DayColors.border,
    paddingTop: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: DayColors.textTertiary,
  },
  value: {
    fontSize: 13,
    fontWeight: '500',
    color: DayColors.text,
  },
  avatarBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: PROJECT_RED,
  },
  avatarBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RelationshipGraph;
