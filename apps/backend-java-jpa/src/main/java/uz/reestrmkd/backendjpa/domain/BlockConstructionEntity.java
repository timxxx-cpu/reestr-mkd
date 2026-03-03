package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "block_construction")
public class BlockConstructionEntity extends BaseEntity {

    @Column(name = "block_id", nullable = false, unique = true)
    private String blockId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "block_id", insertable = false, updatable = false)
    private BuildingBlockEntity block;

    @Column(name = "foundation")
    private String foundation;

    @Column(name = "walls")
    private String walls;

    @Column(name = "slabs")
    private String slabs;

    @Column(name = "roof")
    private String roof;

    @Column(name = "seismicity")
    private Integer seismicity;
}
