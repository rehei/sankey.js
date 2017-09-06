import EfficiencyLevel from './../model/EfficiencyLevel.js';

const lineFunction =
    d3.line()
    .x(function(d) { return d.x; })
    .y(function(d) { return d.y; })
    .curve(d3.curveBasis);

const Side = {
    left: 0,
    right: 1
}

export default function renderLinks(productionLine, layoutedShapes, canvas, options){
    const findShapeById = (function(){
        const allShapes =
            layoutedShapes
            .reduce(
                (aggregate, current) => !!current ? aggregate.concat(current) : aggregate,
                []
            )
            .filter(shape => !!shape);
        return (id) => allShapes.find(shape => shape.id === id);
    })();

    {
        const positionOfLeftFlows = getPositionOfFlowsBySide(Side.left);
        const positionOfRightFlows = getPositionOfFlowsBySide(Side.right);
        for(let edgeData of [...linkDescriptionGenerator(productionLine, positionOfLeftFlows, positionOfRightFlows)]){
            const lengthOfStraightPart = edgeData.distanceBetweenBounds * 0.20;

            const lineData = [
                { x: edgeData.from.x,                        y: edgeData.from.y },
                { x: edgeData.from.x + lengthOfStraightPart, y: edgeData.from.y },
                { x: edgeData.to.x   - lengthOfStraightPart, y: edgeData.to.y },
                { x: edgeData.to.x,                          y: edgeData.to.y }
            ];

            const flowGroup =
                canvas
                .append('g')
                .attr('class', 'flowGroup');

            flowGroup
                .append('path')
                .attr('d', lineFunction(lineData))
                .attr('class', 'flow')
                .attr('data-gradient-start', options.colorCodeForLevel[edgeData.from.efficiencyLevel])
                .attr('data-gradient-end', options.colorCodeForLevel[edgeData.to.efficiencyLevel])
                .attr('data-intensity', edgeData.intensity || 0)
                .attr('data-width', edgeData.width || 0)
                // Not really important since it's going to be replaced by renderGradient metohd.
                .attr('stroke', options.links.color || 'black')
                .attr('stroke-width', edgeData.width)
                .attr('fill', 'none');
        }
    }

    function getUniqVertexIdsByLinkHandSide(side){
        const edgeSide = ({
            [Side.left]: 'from',
            [Side.right]: 'to'
        })[side];

        return _(productionLine.edges)
            .map(edge => edge[edgeSide].id)
            .uniq()
            .value();
    }

    function* xPositionGenerator(groupOfLinksWithCommonSideOfVertex, shapeBounds, side){
        const x =
            side === Side.left
            ? shapeBounds.x2
            : shapeBounds.x1;

        for(let edge of groupOfLinksWithCommonSideOfVertex){
            yield x;
        }
    }

    function* yPositionGenerator(groupOfLinksWithCommonSideOfVertex, shapeBounds, totalFlowWidth){
        let y =  shapeBounds.y1 + (shapeBounds.y2 - shapeBounds.y1 - totalFlowWidth) / 2;
        for(let edge of groupOfLinksWithCommonSideOfVertex){
            const currentFlowWidth = edge.intensity * options.links.maxWidth;
            yield y + currentFlowWidth / 2;
            y = y + currentFlowWidth;
        }
    }

    function* positionForFlowsGenerator(groupOfLinksWithCommonLeftVertex, xGenerator, yGenerator){
        for(let edge of groupOfLinksWithCommonLeftVertex){
            const x = xGenerator.next();
            const y = yGenerator.next();
            const isDone = x.done || y.done;
            const position = {
                id: edge.id,
                x: x.value,
                y: y.value,
            };

            if(isDone)
                return position;
            else
                yield position;
        }
    };

    function* linkDescriptionGenerator(productionLine, leftSidePositionForFlows, rightSidePositionForFlows){
        for(let edge of productionLine.edges){
            const leftPosition = leftSidePositionForFlows.find(x => x.id === edge.id);
            const rightPosition = rightSidePositionForFlows.find(x => x.id === edge.id);
            yield {
                id: edge.id,
                intensity: edge.intensity,
                width: edge.intensity * options.links.maxWidth,
                distanceBetweenBounds: rightPosition.x - leftPosition.x,

                from:{
                    ...leftPosition,
                    efficiencyLevel: edge.from.efficiencyLevel
                },
                to: {
                    ...rightPosition,
                    efficiencyLevel: edge.to.efficiencyLevel,
                }
            };
        }
    };

    function getLinksGroupedByVertexSide(productionLine, side){
        const predicate =
            (side === Side.left)
            ? edge => edge.from.id
            : edge => edge.to.id;

        return _.groupBy(productionLine.edges, predicate);
    }

    function getPositionOfFlowsBySide(side){
        return _(getUniqVertexIdsByLinkHandSide(side))
            .map(function(vertexId){
                const groupOfLinksWithCommonSideOfVertex = getLinksGroupedByVertexSide(productionLine, side)[vertexId];
                const fromShapeBounds = findShapeById(vertexId).GetBoundingBox();
                const totalFlowWidth = groupOfLinksWithCommonSideOfVertex.reduce((aggregate, edge) => edge.intensity * options.links.maxWidth + aggregate, 0);
                const xGenerator = xPositionGenerator(groupOfLinksWithCommonSideOfVertex, fromShapeBounds, side);
                const yGenerator = yPositionGenerator(groupOfLinksWithCommonSideOfVertex, fromShapeBounds, totalFlowWidth);
                return [...positionForFlowsGenerator(groupOfLinksWithCommonSideOfVertex, xGenerator, yGenerator)];
            })
            .flatten()
            .value();
    }
}
