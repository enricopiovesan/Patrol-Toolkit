# Radio Phrase Generation Algorithm

1. Determine run via polygon containment or nearest centerline.
2. Determine lift proximity via threshold.
3. Identify nearest tower.
4. Classify upper/mid/lower by percent along centerline.
5. Determine skier's left/right via cross product.
6. Compose short phrase:
   "{RunName}, {Position}, {Side}, below {LiftName} tower {TowerNumber}"
