package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "block_extensions")
public class BlockExtensionEntity extends BaseEntity {

    @Column(name = "building_id", nullable = false)
    private String buildingId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id", insertable = false, updatable = false)
    private BuildingEntity building;

    @Column(name = "parent_block_id", nullable = false)
    private String parentBlockId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_block_id", insertable = false, updatable = false)
    private BuildingBlockEntity parentBlock;

    @OneToMany(mappedBy = "extension", fetch = FetchType.LAZY)
    private List<FloorEntity> floors = new ArrayList<>();

    @OneToMany(mappedBy = "extension", fetch = FetchType.LAZY)
    private List<UnitEntity> units = new ArrayList<>();

    @Column(name = "label", nullable = false)
    private String label;

    @Column(name = "extension_type", nullable = false)
    private String extensionType = "OTHER";

    @Column(name = "construction_kind", nullable = false)
    private String constructionKind = "capital";

    @Column(name = "floors_count", nullable = false)
    private Integer floorsCount = 1;

    @Column(name = "start_floor_index", nullable = false)
    private Integer startFloorIndex = 1;

    @Column(name = "vertical_anchor_type", nullable = false)
    private String verticalAnchorType = "GROUND";

    @Column(name = "anchor_floor_key")
    private String anchorFloorKey;

    @Column(name = "notes")
    private String notes;
}
